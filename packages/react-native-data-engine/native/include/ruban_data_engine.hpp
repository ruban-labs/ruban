#pragma once

#include <cstdint>
#include <string>
#include <string_view>
#include <vector>

namespace ruban::data {

struct TokenBalance {
  std::int64_t chain_id;
  std::string asset_id;
  std::string symbol;
  std::string name;
  std::string contract_address;
  std::int32_t decimals;
  std::string balance;
  std::string display_balance;
  double price_usd;
  double value_usd;
};

struct ChainSnapshot {
  std::int64_t chain_id;
  std::string chain_key;
  std::string chain_name;
  double value_usd;
  std::int64_t latency_ms;
  std::string source;
};

struct ProtocolPosition {
  std::int64_t chain_id;
  std::string protocol_id;
  std::string position_id;
  std::string protocol_name;
  std::string category;
  double asset_value_usd;
  double debt_value_usd;
  double net_value_usd;
};

struct PortfolioProjection {
  std::string provider_id;
  std::string address;
  std::int64_t observed_at;
  double total_value_usd;
  std::vector<ChainSnapshot> chains;
  std::vector<TokenBalance> tokens;
  std::vector<ProtocolPosition> protocols;
};

enum class SyncMode {
  full,
  incremental,
};

struct ChainReference {
  std::int64_t chain_id;
  std::string chain_key;
};

struct SyncOptions {
  SyncMode mode = SyncMode::full;
  std::vector<ChainReference> chains;
};

struct HttpRequestPlan {
  std::string endpoint_id;
  std::string path;
  std::int32_t timeout_ms;
  std::int32_t max_body_bytes;
  std::int32_t max_attempts;
};

struct ProviderPayload {
  std::string endpoint_id;
  std::int32_t status_code;
  std::string body;
  std::int64_t latency_ms;
  std::int32_t attempts;
};

struct ProviderSyncResult {
  PortfolioProjection projection;
  SyncMode mode;
  std::vector<std::int64_t> replace_chain_ids;
  std::int32_t request_count;
  std::int32_t attempt_count;
};

class PortfolioProvider {
 public:
  virtual ~PortfolioProvider() = default;
  virtual PortfolioProjection fetch(std::string_view address,
                                    std::int64_t observed_at) const = 0;
};

class MockDeBankProvider final : public PortfolioProvider {
 public:
  PortfolioProjection fetch(std::string_view address,
                            std::int64_t observed_at) const override;
};

std::string normalize_evm_address(std::string_view address);
std::vector<HttpRequestPlan> build_debank_request_plan(
    std::string_view address, const SyncOptions& options);
std::string build_debank_request_plan_json(std::string_view address,
                                           std::string_view options_json);
ProviderSyncResult parse_debank_payloads(
    std::string_view address, std::int64_t observed_at,
    const SyncOptions& options, const std::vector<ProviderPayload>& payloads,
    std::string_view source);
ProviderSyncResult create_mock_debank_sync(std::string_view address,
                                           std::int64_t observed_at,
                                           const SyncOptions& options);
std::string create_debank_sync_result_json(
    std::string_view address, std::int64_t observed_at,
    std::string_view options_json, std::string_view payloads_json,
    std::string_view source);
std::string create_mock_debank_sync_result_json(
    std::string_view address, std::int64_t observed_at,
    std::string_view options_json);
std::int64_t retry_delay_ms(std::int32_t status_code,
                            std::int32_t completed_attempts,
                            std::int64_t retry_after_ms,
                            std::int32_t max_attempts = 3);
std::string serialize_projection_json(const PortfolioProjection& projection);
std::string serialize_sync_result_json(const ProviderSyncResult& result);

}
