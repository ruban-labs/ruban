#include "ruban_data_engine.hpp"

#include <algorithm>
#include <array>
#include <cctype>
#include <cmath>
#include <iomanip>
#include <sstream>
#include <stdexcept>

namespace ruban::data {
namespace {

struct MockChain {
  std::int64_t id;
  const char* key;
  const char* name;
  const char* native_symbol;
  const char* native_name;
  const char* stable_address;
  double native_price;
};

constexpr std::array<MockChain, 5> kChains = {{
    {1, "ethereum", "Ethereum", "ETH", "Ether",
     "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", 2480.0},
    {8453, "base", "Base", "ETH", "Ether",
     "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", 2480.0},
    {42161, "arbitrum", "Arbitrum", "ETH", "Ether",
     "0xaf88d065e77c8cc2239327c5edb3a432268e5831", 2480.0},
    {10, "optimism", "Optimism", "ETH", "Ether",
     "0x0b2c639c533813f4aa9d7837caf62653d097ff85", 2480.0},
    {137, "polygon", "Polygon", "POL", "POL",
     "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359", 0.42},
}};

std::uint64_t hash(std::string_view value) {
  std::uint64_t result = 1469598103934665603ULL;
  for (const unsigned char character : value) {
    result ^= character;
    result *= 1099511628211ULL;
  }
  return result;
}

double amount(std::uint64_t seed, std::uint64_t salt, double minimum,
              double range) {
  const auto mixed = (seed ^ (salt * 0x9e3779b97f4a7c15ULL)) % 100000ULL;
  return minimum + range * (static_cast<double>(mixed) / 100000.0);
}

std::string decimal(double value, int precision) {
  std::ostringstream stream;
  stream << std::fixed << std::setprecision(precision) << value;
  return stream.str();
}

std::string atomic(std::string display, int decimals) {
  const auto separator = display.find('.');
  std::string whole = separator == std::string::npos
                          ? display
                          : display.substr(0, separator);
  std::string fraction = separator == std::string::npos
                             ? std::string()
                             : display.substr(separator + 1);
  if (fraction.size() > static_cast<std::size_t>(decimals)) {
    fraction.resize(static_cast<std::size_t>(decimals));
  }
  fraction.append(static_cast<std::size_t>(decimals) - fraction.size(), '0');
  whole.append(fraction);
  const auto first = whole.find_first_not_of('0');
  return first == std::string::npos ? "0" : whole.substr(first);
}

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
  PortfolioProjection projection;
  projection.provider_id = "debank";
  projection.address = normalize_evm_address(address);
  projection.observed_at = observed_at;
  const auto seed = hash(projection.address);

  for (std::size_t index = 0; index < kChains.size(); ++index) {
    const auto& chain = kChains[index];
    const double native_amount =
        amount(seed, chain.id, chain.id == 137 ? 40.0 : 0.08,
               chain.id == 137 ? 400.0 : 1.25);
    const double stable_amount = amount(seed, chain.id + 17, 40.0, 900.0);
    const std::string native_display = decimal(native_amount, 6);
    const std::string stable_display = decimal(stable_amount, 2);
    const double native_value = native_amount * chain.native_price;
    const double chain_value = native_value + stable_amount;

    projection.tokens.push_back(
        {chain.id,
         "native",
         chain.native_symbol,
         chain.native_name,
         "",
         18,
         atomic(native_display, 18),
         native_display,
         chain.native_price,
         native_value});
    projection.tokens.push_back(
        {chain.id,
         chain.stable_address,
         "USDC",
         "USD Coin",
         chain.stable_address,
         6,
         atomic(stable_display, 6),
         stable_display,
         1.0,
         stable_amount});
    projection.chains.push_back(
        {chain.id, chain.key, chain.name, chain_value,
         static_cast<std::int64_t>(28 + ((seed + chain.id) % 145)),
         "debank:mock"});
    projection.total_value_usd += chain_value;
  }

  const double supplied = amount(seed, 71, 250.0, 1800.0);
  const double borrowed = amount(seed, 72, 0.0, 280.0);
  projection.protocols.push_back({1, "aave-v3", "main", "Aave V3",
                                  "lending", supplied, borrowed,
                                  supplied - borrowed});
  const double liquidity = amount(seed, 81, 120.0, 760.0);
  projection.protocols.push_back({8453, "aerodrome", "main", "Aerodrome",
                                  "liquidity", liquidity, 0.0, liquidity});
  projection.total_value_usd += supplied - borrowed + liquidity;
  return projection;
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

}
