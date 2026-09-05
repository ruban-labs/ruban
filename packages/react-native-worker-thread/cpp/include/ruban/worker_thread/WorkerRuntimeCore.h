#pragma once

#include <chrono>
#include <condition_variable>
#include <cstddef>
#include <cstdint>
#include <deque>
#include <functional>
#include <memory>
#include <mutex>
#include <string>
#include <thread>
#include <unordered_map>
#include <vector>

namespace ruban::worker_thread {

/**
 * The core intentionally owns strings, never jsi::Value or another engine
 * object. Engine adapters are created and destroyed on the thread below.
 */
struct WorkerRuntimeLimits {
  std::size_t maxQueueDepth{128};
  std::size_t maxMessageBytes{1024 * 1024};
  std::size_t maxQueueBytes{4 * 1024 * 1024};
  std::chrono::milliseconds maxRuntime{std::chrono::minutes(5)};
};

enum class WorkerRuntimeState {
  Created,
  Running,
  Stopping,
  Terminated,
  Failed,
};

enum class QueueResult {
  Accepted,
  NotRunning,
  MessageTooLarge,
  QueueFull,
  QueueBytesFull,
};

/**
 * An engine adapter must poll shouldStop() while executing a worker message.
 * The core never force-kills an arbitrary native thread because that could
 * destroy engine-owned state while it is still in use.
 */
struct WorkerRuntimeExecutionContext {
  std::chrono::steady_clock::time_point deadline;
  std::function<bool()> shouldStop;
};

/**
 * The engine adapter receives a JSON string and may emit JSON strings through
 * emit(). It must use execution.shouldStop() for deadline and termination
 * handling before returning to this core.
 */
using WorkerMessageHandler = std::function<void(
    const std::string& message,
    const std::function<QueueResult(const std::string&)>& emit,
    const WorkerRuntimeExecutionContext& execution)>;

class WorkerRuntimeCore final {
 public:
  WorkerRuntimeCore(std::string name, WorkerRuntimeLimits limits, WorkerMessageHandler handler);
  ~WorkerRuntimeCore();

  WorkerRuntimeCore(const WorkerRuntimeCore&) = delete;
  WorkerRuntimeCore& operator=(const WorkerRuntimeCore&) = delete;

  bool start();
  QueueResult postToWorker(std::string message);
  std::vector<std::string> drainOutbound(std::size_t maxItems);
  void terminate();

  WorkerRuntimeState state() const;
  std::string failureMessage() const;
  const std::string& name() const noexcept;

  /**
   * Process-local lifecycle diagnostic used by the deterministic core smoke.
   * It counts only threads owned by this core and reaches zero after every
   * joined termination path.
   */
  static std::size_t activeThreadCountForTesting();

 private:
  QueueResult enqueueInboundLocked(std::string&& message);
  QueueResult enqueueOutbound(const std::string& message);
  bool shouldStop(std::chrono::steady_clock::time_point deadline) const;
  void threadMain();
  void setTerminalLocked(WorkerRuntimeState state, std::string failure = {});

  const std::string name_;
  const WorkerRuntimeLimits limits_;
  const WorkerMessageHandler handler_;

  mutable std::mutex mutex_;
  std::mutex joinMutex_;
  std::condition_variable wake_;
  std::deque<std::string> inbound_;
  std::deque<std::string> outbound_;
  std::size_t inboundBytes_{0};
  std::size_t outboundBytes_{0};
  WorkerRuntimeState state_{WorkerRuntimeState::Created};
  bool terminateRequested_{false};
  std::string failureMessage_;
  std::thread thread_;
};

enum class RegistryResult {
  Added,
  DuplicateName,
  WorkerLimitReached,
};

/**
 * One platform module owns one registry. It provides process-local name and
 * concurrency admission before a native thread or engine is allocated.
 */
class WorkerRuntimeRegistry final {
 public:
  explicit WorkerRuntimeRegistry(std::size_t maxWorkers);
  ~WorkerRuntimeRegistry();

  WorkerRuntimeRegistry(const WorkerRuntimeRegistry&) = delete;
  WorkerRuntimeRegistry& operator=(const WorkerRuntimeRegistry&) = delete;

  RegistryResult add(std::unique_ptr<WorkerRuntimeCore> worker);
  bool terminate(const std::string& name);
  void terminateAll();
  std::size_t size() const;

 private:
  const std::size_t maxWorkers_;
  mutable std::mutex mutex_;
  std::unordered_map<std::string, std::unique_ptr<WorkerRuntimeCore>> workers_;
};

} // namespace ruban::worker_thread
