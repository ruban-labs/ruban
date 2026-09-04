#include "ruban_data_engine.hpp"

#include <cassert>
#include <stdexcept>
#include <string>

int main() {
  ruban::data::MockDeBankProvider provider;
  const auto first = provider.fetch(
      "0x0000000000000000000000000000000000000001", 1000);
  const auto second = provider.fetch(
      "0x0000000000000000000000000000000000000001", 1000);
  assert(first.address == second.address);
  assert(first.chains.size() == 5);
  assert(first.tokens.size() == 10);
  assert(first.protocols.size() == 2);
  assert(first.total_value_usd == second.total_value_usd);
  const auto json = ruban::data::serialize_projection_json(first);
  assert(json.find("\"providerId\":\"debank\"") != std::string::npos);
  assert(json.find("\"chainId\":42161") != std::string::npos);

  bool rejected = false;
  try {
    provider.fetch("0x1234", 1000);
  } catch (const std::invalid_argument&) {
    rejected = true;
  }
  assert(rejected);
  return 0;
}
