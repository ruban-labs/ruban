#include "ruban/worker_thread/WorkerRuntimeCore.h"

#include <atomic>
#include <stdexcept>
#include <utility>

namespace ruban::worker_thread {
namespace {

std::atomic<std::size_t> activeThreadCount{0};

bool isTerminal(WorkerRuntimeState state) {
  return state == WorkerRuntimeState::Terminated || state == WorkerRuntimeState::Failed;
}

} // namespace

WorkerRuntimeCore::WorkerRuntimeCore(
    std::string name,
    WorkerRuntimeLimits limits,
    WorkerMessageHandler handler)
    : name_(std::move(name)), limits_(limits), handler_(std::move(handler)) {
  if (name_.empty()) {
    throw std::invalid_argument("worker name must not be empty");
  }
  if (!handler_) {
    throw std::invalid_argument("worker handler must not be empty");
  }
  if (limits_.maxQueueDepth == 0 || limits_.maxMessageBytes == 0 || limits_.maxQueueBytes == 0 ||
      limits_.maxQueueBytes < limits_.maxMessageBytes || limits_.maxRuntime.count() <= 0) {
    throw std::invalid_argument("worker limits are invalid");
  }
}

WorkerRuntimeCore::~WorkerRuntimeCore() {
  terminate();
}

bool WorkerRuntimeCore::start() {
  std::lock_guard<std::mutex> lock(mutex_);
  if (state_ != WorkerRuntimeState::Created) {
    return false;
  }
  state_ = WorkerRuntimeState::Running;
  try {
    thread_ = std::thread(&WorkerRuntimeCore::threadMain, this);
  } catch (const std::exception& error) {
    setTerminalLocked(WorkerRuntimeState::Failed, error.what());
    return false;
  }
  return true;
}

QueueResult WorkerRuntimeCore::enqueueInboundLocked(std::string&& message) {
  if (state_ != WorkerRuntimeState::Running || terminateRequested_) {
    return QueueResult::NotRunning;
  }
  if (message.size() > limits_.maxMessageBytes) {
    return QueueResult::MessageTooLarge;
  }
  if (inbound_.size() >= limits_.maxQueueDepth) {
    return QueueResult::QueueFull;
  }
  if (inboundBytes_ > limits_.maxQueueBytes - message.size()) {
    return QueueResult::QueueBytesFull;
  }
  inboundBytes_ += message.size();
  inbound_.push_back(std::move(message));
  wake_.notify_one();
  return QueueResult::Accepted;
}

QueueResult WorkerRuntimeCore::postToWorker(std::string message) {
  std::lock_guard<std::mutex> lock(mutex_);
  return enqueueInboundLocked(std::move(message));
}

QueueResult WorkerRuntimeCore::enqueueOutbound(const std::string& message) {
  std::lock_guard<std::mutex> lock(mutex_);
  if (state_ != WorkerRuntimeState::Running || terminateRequested_) {
    return QueueResult::NotRunning;
  }
  if (message.size() > limits_.maxMessageBytes) {
    return QueueResult::MessageTooLarge;
  }
  if (outbound_.size() >= limits_.maxQueueDepth) {
    return QueueResult::QueueFull;
  }
  if (outboundBytes_ > limits_.maxQueueBytes - message.size()) {
    return QueueResult::QueueBytesFull;
  }
  outboundBytes_ += message.size();
  outbound_.push_back(message);
  return QueueResult::Accepted;
}

bool WorkerRuntimeCore::shouldStop(std::chrono::steady_clock::time_point deadline) const {
  std::lock_guard<std::mutex> lock(mutex_);
  return terminateRequested_ || std::chrono::steady_clock::now() >= deadline;
}

std::vector<std::string> WorkerRuntimeCore::drainOutbound(std::size_t maxItems) {
  std::vector<std::string> drained;
  std::lock_guard<std::mutex> lock(mutex_);
  const auto amount = std::min(maxItems, outbound_.size());
  drained.reserve(amount);
  for (std::size_t index = 0; index < amount; ++index) {
    outboundBytes_ -= outbound_.front().size();
    drained.push_back(std::move(outbound_.front()));
    outbound_.pop_front();
  }
  return drained;
}

void WorkerRuntimeCore::terminate() {
  {
    std::lock_guard<std::mutex> lock(mutex_);
    if (state_ == WorkerRuntimeState::Created) {
      setTerminalLocked(WorkerRuntimeState::Terminated);
      return;
    }
    if (!isTerminal(state_)) {
      terminateRequested_ = true;
      state_ = WorkerRuntimeState::Stopping;
      inbound_.clear();
      inboundBytes_ = 0;
      wake_.notify_all();
    }
    if (thread_.joinable() && thread_.get_id() == std::this_thread::get_id()) {
      return;
    }
  }

  std::unique_lock<std::mutex> joinLock(joinMutex_);
  std::thread threadToJoin;
  {
    std::lock_guard<std::mutex> lock(mutex_);
    if (thread_.joinable()) {
      threadToJoin = std::move(thread_);
    }
  }
  if (threadToJoin.joinable()) {
    threadToJoin.join();
  }
}

WorkerRuntimeState WorkerRuntimeCore::state() const {
  std::lock_guard<std::mutex> lock(mutex_);
  return state_;
}

std::string WorkerRuntimeCore::failureMessage() const {
  std::lock_guard<std::mutex> lock(mutex_);
  return failureMessage_;
}

const std::string& WorkerRuntimeCore::name() const noexcept {
  return name_;
}

std::size_t WorkerRuntimeCore::activeThreadCountForTesting() {
  return activeThreadCount.load(std::memory_order_acquire);
}

void WorkerRuntimeCore::setTerminalLocked(WorkerRuntimeState state, std::string failure) {
  state_ = state;
  terminateRequested_ = true;
  inbound_.clear();
  outbound_.clear();
  inboundBytes_ = 0;
  outboundBytes_ = 0;
  failureMessage_ = std::move(failure);
}

void WorkerRuntimeCore::threadMain() {
  activeThreadCount.fetch_add(1, std::memory_order_acq_rel);
  struct ThreadCountGuard {
    ~ThreadCountGuard() {
      activeThreadCount.fetch_sub(1, std::memory_order_acq_rel);
    }
  } threadCountGuard;

  const auto deadline = std::chrono::steady_clock::now() + limits_.maxRuntime;
  while (true) {
    std::string message;
    {
      std::unique_lock<std::mutex> lock(mutex_);
      const bool ready = wake_.wait_until(lock, deadline, [this] {
        return terminateRequested_ || !inbound_.empty();
      });
      if (terminateRequested_) {
        setTerminalLocked(WorkerRuntimeState::Terminated);
        return;
      }
      if (!ready || std::chrono::steady_clock::now() >= deadline) {
        setTerminalLocked(WorkerRuntimeState::Failed, "E_RUNTIME_TIMEOUT");
        return;
      }
      message = std::move(inbound_.front());
      inboundBytes_ -= message.size();
      inbound_.pop_front();
    }

    try {
      handler_(
          message,
          [this](const std::string& outgoing) { return enqueueOutbound(outgoing); },
          WorkerRuntimeExecutionContext{
              deadline,
              [this, deadline] { return shouldStop(deadline); },
          });
    } catch (const std::exception& error) {
      std::lock_guard<std::mutex> lock(mutex_);
      setTerminalLocked(WorkerRuntimeState::Failed, error.what());
      return;
    } catch (...) {
      std::lock_guard<std::mutex> lock(mutex_);
      setTerminalLocked(WorkerRuntimeState::Failed, "E_WORKER_EXCEPTION");
      return;
    }

    std::lock_guard<std::mutex> lock(mutex_);
    if (terminateRequested_) {
      setTerminalLocked(WorkerRuntimeState::Terminated);
      return;
    }
    if (std::chrono::steady_clock::now() >= deadline) {
      setTerminalLocked(WorkerRuntimeState::Failed, "E_RUNTIME_TIMEOUT");
      return;
    }
  }
}

WorkerRuntimeRegistry::WorkerRuntimeRegistry(std::size_t maxWorkers) : maxWorkers_(maxWorkers) {
  if (maxWorkers_ == 0) {
    throw std::invalid_argument("max workers must be positive");
  }
}

WorkerRuntimeRegistry::~WorkerRuntimeRegistry() {
  terminateAll();
}

RegistryResult WorkerRuntimeRegistry::add(std::unique_ptr<WorkerRuntimeCore> worker) {
  if (!worker) {
    throw std::invalid_argument("worker must not be null");
  }
  const auto name = worker->name();
  std::lock_guard<std::mutex> lock(mutex_);
  if (workers_.find(name) != workers_.end()) {
    return RegistryResult::DuplicateName;
  }
  if (workers_.size() >= maxWorkers_) {
    return RegistryResult::WorkerLimitReached;
  }
  workers_.emplace(name, std::move(worker));
  return RegistryResult::Added;
}

bool WorkerRuntimeRegistry::terminate(const std::string& name) {
  std::unique_ptr<WorkerRuntimeCore> worker;
  {
    std::lock_guard<std::mutex> lock(mutex_);
    const auto found = workers_.find(name);
    if (found == workers_.end()) {
      return false;
    }
    worker = std::move(found->second);
    workers_.erase(found);
  }
  worker->terminate();
  return true;
}

void WorkerRuntimeRegistry::terminateAll() {
  std::unordered_map<std::string, std::unique_ptr<WorkerRuntimeCore>> workers;
  {
    std::lock_guard<std::mutex> lock(mutex_);
    workers.swap(workers_);
  }
  for (auto& entry : workers) {
    entry.second->terminate();
  }
}

std::size_t WorkerRuntimeRegistry::size() const {
  std::lock_guard<std::mutex> lock(mutex_);
  return workers_.size();
}

} // namespace ruban::worker_thread
