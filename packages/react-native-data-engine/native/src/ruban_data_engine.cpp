#include "ruban_data_engine.hpp"

#include <cctype>
#include <iomanip>
#include <sstream>
#include <stdexcept>

namespace ruban::data {
namespace {

std::string escape_json(std::string_view value) {
  std::ostringstream stream;
  for (const char character : value) {
    switch (character) {
      case '\\':
        stream << "\\\\";
        break;
      case '"':
        stream << "\\\"";
        break;
      case '\n':
        stream << "\\n";
        break;
      case '\r':
        stream << "\\r";
        break;
      case '\t':
        stream << "\\t";
        break;
      default:
        stream << character;
    }
  }
  return stream.str();
}

void string_field(std::ostringstream& stream, const char* name,
                  std::string_view value) {
  stream << '"' << name << "\":\"" << escape_json(value) << '"';
}

}

std::string normalize_evm_address(std::string_view address) {
  if (address.size() != 42 || address[0] != '0' ||
      (address[1] != 'x' && address[1] != 'X')) {
    throw std::invalid_argument("invalid_evm_address");
  }
  std::string normalized(address);
  normalized[1] = 'x';
  for (std::size_t index = 2; index < normalized.size(); ++index) {
    const auto character = static_cast<unsigned char>(normalized[index]);
    if (!std::isxdigit(character)) {
      throw std::invalid_argument("invalid_evm_address");
    }
    normalized[index] = static_cast<char>(std::tolower(character));
  }
  return normalized;
}

PortfolioProjection MockDeBankProvider::fetch(std::string_view address,
                                               std::int64_t observed_at) const {
  return create_mock_debank_sync(address, observed_at, SyncOptions{}).projection;
}

std::string serialize_projection_json(const PortfolioProjection& projection) {
  std::ostringstream stream;
  stream << std::fixed << std::setprecision(8) << '{';
  string_field(stream, "providerId", projection.provider_id);
  stream << ',';
  string_field(stream, "address", projection.address);
  stream << ",\"observedAt\":" << projection.observed_at
         << ",\"totalValueUsd\":" << projection.total_value_usd
         << ",\"chains\":[";
  for (std::size_t index = 0; index < projection.chains.size(); ++index) {
    if (index) stream << ',';
    const auto& chain = projection.chains[index];
    stream << "{\"chainId\":" << chain.chain_id << ',';
    string_field(stream, "chainKey", chain.chain_key);
    stream << ',';
    string_field(stream, "chainName", chain.chain_name);
    stream << ",\"valueUsd\":" << chain.value_usd
           << ",\"latencyMs\":" << chain.latency_ms << ',';
    string_field(stream, "source", chain.source);
    stream << '}';
  }
  stream << "],\"tokens\":[";
  for (std::size_t index = 0; index < projection.tokens.size(); ++index) {
    if (index) stream << ',';
    const auto& token = projection.tokens[index];
    stream << "{\"chainId\":" << token.chain_id << ',';
    string_field(stream, "assetId", token.asset_id);
    stream << ',';
    string_field(stream, "symbol", token.symbol);
    stream << ',';
    string_field(stream, "name", token.name);
    stream << ',';
    string_field(stream, "contractAddress", token.contract_address);
    stream << ",\"decimals\":" << token.decimals << ',';
    string_field(stream, "balance", token.balance);
    stream << ',';
    string_field(stream, "displayBalance", token.display_balance);
    stream << ",\"priceUsd\":" << token.price_usd
           << ",\"valueUsd\":" << token.value_usd << '}';
  }
  stream << "],\"protocols\":[";
  for (std::size_t index = 0; index < projection.protocols.size(); ++index) {
    if (index) stream << ',';
    const auto& protocol = projection.protocols[index];
    stream << "{\"chainId\":" << protocol.chain_id << ',';
    string_field(stream, "protocolId", protocol.protocol_id);
    stream << ',';
    string_field(stream, "positionId", protocol.position_id);
    stream << ',';
    string_field(stream, "protocolName", protocol.protocol_name);
    stream << ',';
    string_field(stream, "category", protocol.category);
    stream << ",\"assetValueUsd\":" << protocol.asset_value_usd
           << ",\"debtValueUsd\":" << protocol.debt_value_usd
           << ",\"netValueUsd\":" << protocol.net_value_usd << '}';
  }
  stream << "]}";
  return stream.str();
}

std::string serialize_sync_result_json(const ProviderSyncResult& result) {
  std::string output = serialize_projection_json(result.projection);
  if (output.empty() || output.back() != '}') {
    throw std::runtime_error("projection_serialize_failed");
  }
  output.pop_back();
  output.append(",\"replaceMode\":\"");
  output.append(result.mode == SyncMode::full ? "full" : "chains");
  output.append("\",\"replaceChainIds\":[");
  for (std::size_t index = 0; index < result.replace_chain_ids.size(); ++index) {
    if (index) output.push_back(',');
    output.append(std::to_string(result.replace_chain_ids[index]));
  }
  output.append("],\"requestCount\":");
  output.append(std::to_string(result.request_count));
  output.append(",\"attemptCount\":");
  output.append(std::to_string(result.attempt_count));
  output.push_back('}');
  return output;
}

}
