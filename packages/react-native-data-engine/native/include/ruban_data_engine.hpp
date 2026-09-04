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
std::string serialize_projection_json(const PortfolioProjection& projection);

}
