#include "ruban/worker_thread/WorkerRuntimeCore.h"

#include <cassert>
#include <atomic>
#include <chrono>
#include <stdexcept>
#include <string>
#include <thread>

using ruban::worker_thread::QueueResult;
using ruban::worker_thread::RegistryResult;
using ruban::worker_thread::WorkerRuntimeCore;
using ruban::worker_thread::WorkerRuntimeLimits;
using ruban::worker_thread::WorkerRuntimeRegistry;
using ruban::worker_thread::WorkerRuntimeState;

namespace {

bool waitForState(
    WorkerRuntimeCore& runtime,
    WorkerRuntimeState expected,
    std::chrono::milliseconds timeout = std::chrono::milliseconds(500)) {
  const auto deadline = std::chrono::steady_clock::now() + timeout;
  while (std::chrono::steady_clock::now() < deadline) {
    if (runtime.state() == expected) {
      return true;
    }
    std::this_thread::sleep_for(std::chrono::milliseconds(2));
  }
  return runtime.state() == expected;
}

} // namespace

int main() {
  WorkerRuntimeLimits limits;
  limits.maxQueueDepth = 2;
  limits.maxMessageBytes = 64;
  limits.maxQueueBytes = 64;
  limits.maxRuntime = std::chrono::seconds(1);

  WorkerRuntimeCore runtime("echo-smoke", limits, [](const std::string& message, const auto& emit, const auto&) {
    assert(emit(message) == QueueResult::Accepted);
  });
  assert(runtime.start());
  assert(runtime.postToWorker("{\"kind\":\"echo\",\"value\":\"hello\"}") == QueueResult::Accepted);

  for (int attempt = 0; attempt < 100; ++attempt) {
    auto outbound = runtime.drainOutbound(1);
    if (!outbound.empty()) {
      assert(outbound.front() == "{\"kind\":\"echo\",\"value\":\"hello\"}");
      break;
    }
    std::this_thread::sleep_for(std::chrono::milliseconds(5));
    if (attempt == 99) assert(false && "echo message was not delivered");
  }

  assert(runtime.postToWorker(std::string(65, 'x')) == QueueResult::MessageTooLarge);
  runtime.terminate();
  assert(runtime.state() == WorkerRuntimeState::Terminated);
  assert(runtime.postToWorker("{}") == QueueResult::NotRunning);
  assert(WorkerRuntimeCore::activeThreadCountForTesting() == 0);

  WorkerRuntimeCore failingRuntime(
      "error-smoke",
      limits,
      [](const std::string&, const auto&, const auto&) { throw std::runtime_error("E_WORKER_EXCEPTION"); });
  assert(failingRuntime.start());
  assert(failingRuntime.postToWorker("{}") == QueueResult::Accepted);
  assert(waitForState(failingRuntime, WorkerRuntimeState::Failed));
  assert(failingRuntime.failureMessage() == "E_WORKER_EXCEPTION");
  failingRuntime.terminate();
  assert(WorkerRuntimeCore::activeThreadCountForTesting() == 0);

  for (int wave = 0; wave < 128; ++wave) {
    WorkerRuntimeCore cycleRuntime(
        "cycle-" + std::to_string(wave),
        limits,
        [](const std::string&, const auto&, const auto&) {});
    assert(cycleRuntime.start());
    assert(cycleRuntime.postToWorker("{}") == QueueResult::Accepted);
    cycleRuntime.terminate();
    assert(cycleRuntime.state() == WorkerRuntimeState::Terminated);
    assert(WorkerRuntimeCore::activeThreadCountForTesting() == 0);
  }

  WorkerRuntimeRegistry registry(2);
  auto makeWorker = [&limits](const std::string& name) {
    return std::make_unique<WorkerRuntimeCore>(name, limits, [](const std::string&, const auto&, const auto&) {});
  };
  assert(registry.add(makeWorker("first")) == RegistryResult::Added);
  assert(registry.add(makeWorker("second")) == RegistryResult::Added);
  assert(registry.add(makeWorker("second")) == RegistryResult::DuplicateName);
  assert(registry.add(makeWorker("third")) == RegistryResult::WorkerLimitReached);
  assert(registry.terminate("first"));
  assert(!registry.terminate("first"));
  registry.terminateAll();
  assert(registry.size() == 0);
  assert(WorkerRuntimeCore::activeThreadCountForTesting() == 0);

  std::atomic<bool> cancellationHandlerStarted{false};
  WorkerRuntimeCore cancellationRuntime(
      "cancellation-smoke",
      limits,
      [&cancellationHandlerStarted](const std::string&, const auto&, const auto& execution) {
        cancellationHandlerStarted.store(true, std::memory_order_release);
        while (!execution.shouldStop()) {
          std::this_thread::sleep_for(std::chrono::milliseconds(1));
        }
      });
  assert(cancellationRuntime.start());
  assert(cancellationRuntime.postToWorker("{}") == QueueResult::Accepted);
  for (int attempt = 0; attempt < 100 && !cancellationHandlerStarted.load(std::memory_order_acquire); ++attempt) {
    std::this_thread::sleep_for(std::chrono::milliseconds(2));
  }
  assert(cancellationHandlerStarted.load(std::memory_order_acquire));
  const auto terminationStarted = std::chrono::steady_clock::now();
  cancellationRuntime.terminate();
  assert(cancellationRuntime.state() == WorkerRuntimeState::Terminated);
  assert(std::chrono::steady_clock::now() - terminationStarted < std::chrono::milliseconds(500));
  assert(WorkerRuntimeCore::activeThreadCountForTesting() == 0);

  WorkerRuntimeLimits timeoutLimits = limits;
  timeoutLimits.maxRuntime = std::chrono::milliseconds(10);
  WorkerRuntimeCore timeoutRuntime(
      "timeout-smoke",
      timeoutLimits,
      [](const std::string&, const auto&, const auto& execution) {
        while (!execution.shouldStop()) {
          std::this_thread::sleep_for(std::chrono::milliseconds(1));
        }
      });
  assert(timeoutRuntime.start());
  assert(timeoutRuntime.postToWorker("{}") == QueueResult::Accepted);
  assert(waitForState(timeoutRuntime, WorkerRuntimeState::Failed));
  assert(timeoutRuntime.failureMessage() == "E_RUNTIME_TIMEOUT");
  timeoutRuntime.terminate();
  assert(WorkerRuntimeCore::activeThreadCountForTesting() == 0);
  return 0;
}
