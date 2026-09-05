#include "ruban_data_engine.hpp"

#include "ruban_json.hpp"

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <iomanip>
#include <limits>
#include <map>
#include <set>
#include <sstream>
#include <stdexcept>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

namespace ruban::data {
namespace {

constexpr std::int32_t kTimeoutMs = 7000;
constexpr std::int32_t kMaxBodyBytes = 4 * 1024 * 1024;
constexpr std::int32_t kMaxAttempts = 3;
constexpr std::int64_t kMaxRetryDelayMs = 5000;

const json::Value& require_field(const json::Value& value,
                                 std::string_view key) {
  const json::Value* field = value.find(key);
  if (field == nullptr || field->is_null()) {
    throw std::invalid_argument("provider_contract_invalid");
  }
  return *field;
}

std::string optional_string(const json::Value& value, std::string_view key) {
  const json::Value* field = value.find(key);
  if (field == nullptr || field->is_null()) return {};
  return field->as_string();
}

double require_nonnegative_number(const json::Value& value,
                                  std::string_view key) {
  const double result = require_field(value, key).as_double();
  if (!std::isfinite(result) || result < 0) {
    throw std::invalid_argument("provider_contract_invalid");
  }
  return result;
}

std::int32_t optional_decimals(const json::Value& value) {
  const json::Value* field = value.find("decimals");
  if (field == nullptr || field->is_null()) return 0;
  const std::int64_t result = field->as_int64();
  if (result < 0 || result > 255) {
    throw std::invalid_argument("provider_contract_invalid");
  }
  return static_cast<std::int32_t>(result);
}

bool is_valid_chain_key(std::string_view value) {
  if (value.empty() || value.size() > 32) return false;
  return std::all_of(value.begin(), value.end(), [](unsigned char character) {
    return (character >= 'a' && character <= 'z') ||
           (character >= '0' && character <= '9') || character == '_' ||
           character == '-';
  });
}

std::vector<ChainReference> validate_options(const SyncOptions& options) {
  if (options.mode == SyncMode::full) return {};
  if (options.chains.empty() || options.chains.size() > 128) {
    throw std::invalid_argument("invalid_incremental_chains");
  }
  std::set<std::int64_t> ids;
  std::set<std::string> keys;
  for (const auto& chain : options.chains) {
    if (chain.chain_id <= 0 || !is_valid_chain_key(chain.chain_key) ||
        !ids.insert(chain.chain_id).second ||
        !keys.insert(chain.chain_key).second) {
      throw std::invalid_argument("invalid_incremental_chains");
    }
  }
  return options.chains;
}

std::string chain_query(const std::vector<ChainReference>& chains) {
  std::string output;
  for (const auto& chain : chains) {
    if (!output.empty()) output.push_back(',');
    output.append(chain.chain_key);
  }
  return output;
}

std::string display_number(double value, std::int32_t decimals) {
  const int precision = std::max(0, std::min<int>(decimals, 8));
  std::ostringstream stream;
  stream << std::fixed << std::setprecision(precision) << value;
  std::string output = stream.str();
  const auto separator = output.find('.');
  if (separator != std::string::npos) {
    while (!output.empty() && output.back() == '0') output.pop_back();
    if (!output.empty() && output.back() == '.') output.pop_back();
  }
  return output.empty() ? "0" : output;
}

std::string decimal_to_atomic(std::string_view text, std::int32_t decimals) {
  if (text.empty() || decimals < 0) {
    throw std::invalid_argument("provider_contract_invalid");
  }
  std::size_t position = 0;
  if (text[position] == '+') ++position;
  if (position < text.size() && text[position] == '-') {
    throw std::invalid_argument("provider_contract_invalid");
  }
  std::string digits;
  std::int64_t fractional = 0;
  bool after_separator = false;
  while (position < text.size() && text[position] != 'e' &&
         text[position] != 'E') {
    const char character = text[position++];
    if (character == '.') {
      if (after_separator) throw std::invalid_argument("provider_contract_invalid");
      after_separator = true;
      continue;
    }
    if (character < '0' || character > '9') {
      throw std::invalid_argument("provider_contract_invalid");
    }
    digits.push_back(character);
    if (after_separator) ++fractional;
  }
  if (digits.empty()) throw std::invalid_argument("provider_contract_invalid");
  std::int64_t exponent = 0;
  if (position < text.size()) {
    ++position;
    bool negative = false;
    if (position < text.size() &&
        (text[position] == '+' || text[position] == '-')) {
      negative = text[position++] == '-';
    }
    if (position == text.size()) throw std::invalid_argument("provider_contract_invalid");
    while (position < text.size()) {
      const char character = text[position++];
      if (character < '0' || character > '9' || exponent > 10000) {
        throw std::invalid_argument("provider_contract_invalid");
      }
      exponent = exponent * 10 + (character - '0');
    }
    if (negative) exponent = -exponent;
  }
  const std::int64_t zeros = static_cast<std::int64_t>(decimals) + exponent - fractional;
  if (zeros < 0) {
    const auto remove = static_cast<std::size_t>(-zeros);
    if (remove >= digits.size()) return "0";
    digits.resize(digits.size() - remove);
  } else {
    if (zeros > 10000) throw std::invalid_argument("provider_contract_invalid");
    digits.append(static_cast<std::size_t>(zeros), '0');
  }
  const auto first = digits.find_first_not_of('0');
  return first == std::string::npos ? "0" : digits.substr(first);
}

std::string raw_amount(const json::Value& token, std::int32_t decimals) {
  const json::Value* raw = token.find("raw_amount");
  if (raw != nullptr && !raw->is_null()) {
    std::string result = raw->is_string() ? raw->as_string() : raw->number_text();
    if (!result.empty() &&
        std::all_of(result.begin(), result.end(), [](unsigned char character) {
          return character >= '0' && character <= '9';
        })) {
      const auto first = result.find_first_not_of('0');
      return first == std::string::npos ? "0" : result.substr(first);
    }
  }
  return decimal_to_atomic(require_field(token, "amount").number_text(),
                           decimals);
}

std::string display_symbol(const json::Value& token) {
  for (const char* key : {"optimized_symbol", "display_symbol", "symbol"}) {
    const std::string value = optional_string(token, key);
    if (!value.empty()) return value;
  }
  return "Unknown";
}

struct ChainMetadata {
  std::int64_t id;
  std::string key;
  std::string name;
  double value_usd;
};

bool includes_chain(const SyncOptions& options, std::string_view key) {
  if (options.mode == SyncMode::full) return true;
  return std::any_of(options.chains.begin(), options.chains.end(),
                     [key](const ChainReference& chain) {
                       return chain.chain_key == key;
                     });
}

const ProviderPayload& require_payload(
    const std::map<std::string, const ProviderPayload*>& payloads,
    const char* endpoint_id) {
  const auto iterator = payloads.find(endpoint_id);
  if (iterator == payloads.end()) {
    throw std::invalid_argument("provider_contract_invalid");
  }
  const ProviderPayload& payload = *iterator->second;
  if (payload.status_code < 200 || payload.status_code >= 300) {
    throw std::runtime_error("provider_http_failed");
  }
  if (payload.body.empty() ||
      payload.body.size() > static_cast<std::size_t>(kMaxBodyBytes) ||
      payload.latency_ms < 0 || payload.attempts <= 0 ||
      payload.attempts > kMaxAttempts) {
    throw std::invalid_argument("provider_contract_invalid");
  }
  return payload;
}

std::vector<ProviderPayload> mock_payloads() {
  return {
      {"total_balance", 200,
       R"({"total_usd_value":1400.08,"chain_list":[{"id":"eth","community_id":1,"name":"Ethereum","native_token_id":"eth","wrapped_token_id":"0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2","usd_value":1021.45},{"id":"base","community_id":8453,"name":"Base","native_token_id":"eth","wrapped_token_id":"0x4200000000000000000000000000000000000006","usd_value":174.12},{"id":"arb","community_id":42161,"name":"Arbitrum","native_token_id":"eth","wrapped_token_id":"0x82af49447d8a07e3bd95bd0d56f35241523fbab1","usd_value":96.31},{"id":"op","community_id":10,"name":"Optimism","native_token_id":"eth","wrapped_token_id":"0x4200000000000000000000000000000000000006","usd_value":64.2},{"id":"matic","community_id":137,"name":"Polygon","native_token_id":"matic","wrapped_token_id":"0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270","usd_value":44.0}]})",
       42, 1},
      {"all_token_list", 200,
       R"([{"id":"eth","chain":"eth","name":"Ether","symbol":"ETH","display_symbol":null,"optimized_symbol":"ETH","decimals":18,"price":2480,"amount":0.2592,"raw_amount":259200000000000000},{"id":"0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48","chain":"eth","name":"USD Coin","symbol":"USDC","display_symbol":null,"optimized_symbol":"USDC","decimals":6,"price":1,"amount":378.63,"raw_amount":378630000},{"id":"eth","chain":"base","name":"Ether","symbol":"ETH","optimized_symbol":"ETH","decimals":18,"price":2480,"amount":0.05,"raw_amount":50000000000000000},{"id":"0x833589fcd6edb6e08f4c7c32d4f71b54bda02913","chain":"base","name":"USD Coin","symbol":"USDC","optimized_symbol":"USDC","decimals":6,"price":1,"amount":50.12,"raw_amount":50120000},{"id":"eth","chain":"arb","name":"Ether","symbol":"ETH","optimized_symbol":"ETH","decimals":18,"price":2480,"amount":0.025,"raw_amount":25000000000000000},{"id":"0xaf88d065e77c8cc2239327c5edb3a432268e5831","chain":"arb","name":"USD Coin","symbol":"USDC","optimized_symbol":"USDC","decimals":6,"price":1,"amount":34.31,"raw_amount":34310000},{"id":"eth","chain":"op","name":"Ether","symbol":"ETH","optimized_symbol":"ETH","decimals":18,"price":2480,"amount":0.015,"raw_amount":15000000000000000},{"id":"0x0b2c639c533813f4aa9d7837caf62653d097ff85","chain":"op","name":"USD Coin","symbol":"USDC","optimized_symbol":"USDC","decimals":6,"price":1,"amount":27,"raw_amount":27000000},{"id":"matic","chain":"matic","name":"POL","symbol":"POL","optimized_symbol":"POL","decimals":18,"price":0.42,"amount":40,"raw_amount":40000000000000000000},{"id":"0x3c499c542cef5e3811e1192ce70d8cc03d5c3359","chain":"matic","name":"USD Coin","symbol":"USDC","optimized_symbol":"USDC","decimals":6,"price":1,"amount":27.2,"raw_amount":27200000}])",
       35, 1},
      {"all_simple_protocol_list", 200,
       R"([{"id":"aave3","chain":"eth","name":"Aave V3","has_supported_portfolio":true,"net_usd_value":210.02,"asset_usd_value":245.02,"debt_usd_value":35},{"id":"aerodrome","chain":"base","name":"Aerodrome","has_supported_portfolio":true,"net_usd_value":80,"asset_usd_value":80,"debt_usd_value":0}])",
       27, 1},
  };
}

SyncOptions parse_options_json(std::string_view input) {
  try {
    const json::Value root = json::parse(input);
    if (!root.is_object()) throw std::invalid_argument("invalid_sync_options");
    SyncOptions options;
    const std::string mode = require_field(root, "mode").as_string();
    if (mode == "full") {
      options.mode = SyncMode::full;
    } else if (mode == "incremental") {
      options.mode = SyncMode::incremental;
    } else {
      throw std::invalid_argument("invalid_sync_options");
    }
    const json::Value* chains = root.find("chains");
    if (chains != nullptr && !chains->is_null()) {
      for (const auto& chain : chains->as_array()) {
        options.chains.push_back({require_field(chain, "id").as_int64(),
                                  require_field(chain, "key").as_string()});
      }
    }
    validate_options(options);
    return options;
  } catch (const std::invalid_argument& error) {
    if (std::string_view(error.what()) == "invalid_incremental_chains") throw;
    throw std::invalid_argument("invalid_sync_options");
  }
}

std::int32_t bounded_int32(const json::Value& value) {
  const std::int64_t parsed = value.as_int64();
  if (parsed < std::numeric_limits<std::int32_t>::min() ||
      parsed > std::numeric_limits<std::int32_t>::max()) {
    throw std::invalid_argument("provider_contract_invalid");
  }
  return static_cast<std::int32_t>(parsed);
}

std::vector<ProviderPayload> parse_payloads_json(std::string_view input) {
  try {
    const json::Value root = json::parse(input);
    if (!root.is_array()) throw std::invalid_argument("provider_contract_invalid");
    std::vector<ProviderPayload> payloads;
    for (const auto& payload : root.as_array()) {
      payloads.push_back(
          {require_field(payload, "endpointId").as_string(),
           bounded_int32(require_field(payload, "statusCode")),
           require_field(payload, "body").as_string(),
           require_field(payload, "latencyMs").as_int64(),
           bounded_int32(require_field(payload, "attempts"))});
    }
    return payloads;
  } catch (const std::invalid_argument&) {
    throw std::invalid_argument("provider_contract_invalid");
  }
}

std::string escape_json(std::string_view value) {
  std::string output;
  output.reserve(value.size());
  for (const char character : value) {
    switch (character) {
      case '\\': output.append("\\\\"); break;
      case '"': output.append("\\\""); break;
      case '\n': output.append("\\n"); break;
      case '\r': output.append("\\r"); break;
      case '\t': output.append("\\t"); break;
      default: output.push_back(character); break;
    }
  }
  return output;
}

}

std::vector<HttpRequestPlan> build_debank_request_plan(
    std::string_view address, const SyncOptions& options) {
  const std::string normalized = normalize_evm_address(address);
  const auto chains = validate_options(options);
  const std::string filter = chain_query(chains);
  const std::string chain_parameter =
      filter.empty() ? std::string() : "&chain_ids=" + filter;
  return {
      {"total_balance", "/v1/user/total_balance?id=" + normalized,
       kTimeoutMs, kMaxBodyBytes, kMaxAttempts},
      {"all_token_list",
       "/v1/user/all_token_list?id=" + normalized +
           "&is_all=false" + chain_parameter,
       kTimeoutMs, kMaxBodyBytes, kMaxAttempts},
      {"all_simple_protocol_list",
       "/v1/user/all_simple_protocol_list?id=" + normalized + chain_parameter,
       kTimeoutMs, kMaxBodyBytes, kMaxAttempts},
  };
}

std::string build_debank_request_plan_json(std::string_view address,
                                           std::string_view options_json) {
  const auto requests =
      build_debank_request_plan(address, parse_options_json(options_json));
  std::ostringstream output;
  output << '[';
  for (std::size_t index = 0; index < requests.size(); ++index) {
    if (index) output << ',';
    const auto& request = requests[index];
    output << "{\"endpointId\":\"" << escape_json(request.endpoint_id)
           << "\",\"path\":\"" << escape_json(request.path)
           << "\",\"timeoutMs\":" << request.timeout_ms
           << ",\"maxBodyBytes\":" << request.max_body_bytes
           << ",\"maxAttempts\":" << request.max_attempts << '}';
  }
  output << ']';
  return output.str();
}

ProviderSyncResult parse_debank_payloads(
    std::string_view address, std::int64_t observed_at,
    const SyncOptions& options, const std::vector<ProviderPayload>& payloads,
    std::string_view source) {
  validate_options(options);
  if (source.empty() || source.size() > 64 || payloads.size() != 3) {
    throw std::invalid_argument("provider_contract_invalid");
  }
  std::map<std::string, const ProviderPayload*> indexed;
  std::int32_t attempt_count = 0;
  for (const auto& payload : payloads) {
    if (!indexed.emplace(payload.endpoint_id, &payload).second) {
      throw std::invalid_argument("provider_contract_invalid");
    }
    attempt_count += payload.attempts;
  }
  const auto& total_payload = require_payload(indexed, "total_balance");
  const auto& token_payload = require_payload(indexed, "all_token_list");
  const auto& protocol_payload =
      require_payload(indexed, "all_simple_protocol_list");
  json::Value total;
  json::Value tokens;
  json::Value protocols;
  try {
    total = json::parse(total_payload.body);
    tokens = json::parse(token_payload.body);
    protocols = json::parse(protocol_payload.body);
  } catch (const std::invalid_argument&) {
    throw std::invalid_argument("provider_contract_invalid");
  }
  if (!total.is_object() || !tokens.is_array() || !protocols.is_array()) {
    throw std::invalid_argument("provider_contract_invalid");
  }

  ProviderSyncResult result;
  result.mode = options.mode;
  result.request_count = static_cast<std::int32_t>(payloads.size());
  result.attempt_count = attempt_count;
  result.projection.provider_id = "debank";
  result.projection.address = normalize_evm_address(address);
  result.projection.observed_at = observed_at;
  result.projection.total_value_usd =
      require_nonnegative_number(total, "total_usd_value");

  std::map<std::string, ChainMetadata> chain_metadata;
  for (const auto& chain : require_field(total, "chain_list").as_array()) {
    const std::string key = require_field(chain, "id").as_string();
    const std::int64_t id = require_field(chain, "community_id").as_int64();
    const std::string name = require_field(chain, "name").as_string();
    const double value_usd = require_nonnegative_number(chain, "usd_value");
    if (id <= 0 || !is_valid_chain_key(key) || name.empty() ||
        !chain_metadata.emplace(key, ChainMetadata{id, key, name, value_usd})
             .second) {
      throw std::invalid_argument("provider_contract_invalid");
    }
  }

  if (options.mode == SyncMode::full) {
    for (const auto& [key, chain] : chain_metadata) {
      (void)key;
      result.replace_chain_ids.push_back(chain.id);
    }
  } else {
    for (const auto& chain : options.chains) {
      result.replace_chain_ids.push_back(chain.chain_id);
      const auto iterator = chain_metadata.find(chain.chain_key);
      if (iterator != chain_metadata.end() && iterator->second.id != chain.chain_id) {
        throw std::invalid_argument("provider_contract_invalid");
      }
    }
  }

  for (const auto& [key, chain] : chain_metadata) {
    if (!includes_chain(options, key)) continue;
    result.projection.chains.push_back(
        {chain.id, chain.key, chain.name, chain.value_usd,
         total_payload.latency_ms, std::string(source)});
  }

  for (const auto& token : tokens.as_array()) {
    const std::string chain_key = require_field(token, "chain").as_string();
    if (!includes_chain(options, chain_key)) continue;
    const auto chain = chain_metadata.find(chain_key);
    if (chain == chain_metadata.end()) {
      throw std::invalid_argument("provider_contract_invalid");
    }
    const std::string asset_id = require_field(token, "id").as_string();
    const double amount = require_nonnegative_number(token, "amount");
    const double price = require_nonnegative_number(token, "price");
    const std::int32_t decimals = optional_decimals(token);
    const std::string symbol = display_symbol(token);
    std::string name = optional_string(token, "name");
    if (name.empty()) name = symbol;
    const bool contract = asset_id.size() == 42 && asset_id[0] == '0' &&
                          (asset_id[1] == 'x' || asset_id[1] == 'X');
    result.projection.tokens.push_back(
        {chain->second.id, asset_id, symbol, name,
         contract ? normalize_evm_address(asset_id) : std::string(), decimals,
         raw_amount(token, decimals), display_number(amount, decimals),
         price, amount * price});
  }

  for (const auto& protocol : protocols.as_array()) {
    const std::string chain_key = require_field(protocol, "chain").as_string();
    if (!includes_chain(options, chain_key)) continue;
    const auto chain = chain_metadata.find(chain_key);
    if (chain == chain_metadata.end()) {
      throw std::invalid_argument("provider_contract_invalid");
    }
    const std::string protocol_id = require_field(protocol, "id").as_string();
    std::string protocol_name = optional_string(protocol, "name");
    if (protocol_name.empty()) protocol_name = protocol_id;
    const double asset = require_nonnegative_number(protocol, "asset_usd_value");
    const double debt = require_nonnegative_number(protocol, "debt_usd_value");
    const double net = require_field(protocol, "net_usd_value").as_double();
    if (!std::isfinite(net)) {
      throw std::invalid_argument("provider_contract_invalid");
    }
    result.projection.protocols.push_back(
        {chain->second.id, protocol_id, "aggregate", protocol_name,
         "protocol", asset, debt, net});
  }

  std::sort(result.replace_chain_ids.begin(), result.replace_chain_ids.end());
  std::sort(result.projection.chains.begin(), result.projection.chains.end(),
            [](const ChainSnapshot& left, const ChainSnapshot& right) {
              return left.chain_id < right.chain_id;
            });
  return result;
}

ProviderSyncResult create_mock_debank_sync(std::string_view address,
                                           std::int64_t observed_at,
                                           const SyncOptions& options) {
  return parse_debank_payloads(address, observed_at, options, mock_payloads(),
                               "debank:mock");
}

std::string create_debank_sync_result_json(
    std::string_view address, std::int64_t observed_at,
    std::string_view options_json, std::string_view payloads_json,
    std::string_view source) {
  const auto options = parse_options_json(options_json);
  return serialize_sync_result_json(parse_debank_payloads(
      address, observed_at, options, parse_payloads_json(payloads_json), source));
}

std::string create_mock_debank_sync_result_json(
    std::string_view address, std::int64_t observed_at,
    std::string_view options_json) {
  return serialize_sync_result_json(create_mock_debank_sync(
      address, observed_at, parse_options_json(options_json)));
}

std::int64_t retry_delay_ms(std::int32_t status_code,
                            std::int32_t completed_attempts,
                            std::int64_t retry_after_ms,
                            std::int32_t max_attempts) {
  if (completed_attempts <= 0 || completed_attempts >= max_attempts ||
      max_attempts <= 0) {
    return -1;
  }
  const bool transient = status_code == 408 || status_code == 429 ||
                         status_code == 0 || status_code >= 500;
  if (!transient) return -1;
  if (retry_after_ms >= 0) {
    return std::min(retry_after_ms, kMaxRetryDelayMs);
  }
  const std::int64_t exponential =
      200LL << std::min<std::int32_t>(completed_attempts - 1, 4);
  return std::min(exponential, kMaxRetryDelayMs);
}

}
