#define DOCTEST_CONFIG_IMPLEMENT_WITH_MAIN
#include "doctest-v2.5.3.h"

#include "ruban_data_engine.hpp"

#include <stdexcept>
#include <string>
#include <vector>

namespace {

std::vector<ruban::data::ProviderPayload> payloads(
    std::string total_body,
    std::string token_body = "[]",
    std::string protocol_body = "[]") {
  return {
      {"total_balance", 200, std::move(total_body), 12, 1},
      {"all_token_list", 200, std::move(token_body), 14, 1},
      {"all_simple_protocol_list", 200, std::move(protocol_body), 16, 1},
  };
}

const char* address = "0x0000000000000000000000000000000000000001";

}

TEST_CASE("the documented DeBank fixture becomes a stable projection") {
  ruban::data::MockDeBankProvider provider;
  const auto first = provider.fetch(
      "0x0000000000000000000000000000000000000001", 1000);
  const auto second = provider.fetch(
      "0x0000000000000000000000000000000000000001", 1000);
  CHECK(first.address == second.address);
  CHECK(first.chains.size() == 5);
  CHECK(first.tokens.size() == 10);
  CHECK(first.protocols.size() == 2);
  CHECK(first.total_value_usd == doctest::Approx(1400.08));
  CHECK(first.total_value_usd == second.total_value_usd);
  const auto json = ruban::data::serialize_projection_json(first);
  CHECK(json.find("\"providerId\":\"debank\"") != std::string::npos);
  CHECK(json.find("\"chainId\":42161") != std::string::npos);
}

TEST_CASE("request plans are bounded and chain-filtered") {
  const auto full = ruban::data::build_debank_request_plan(
      "0x0000000000000000000000000000000000000001", {});
  REQUIRE(full.size() == 3);
  CHECK(full[0].endpoint_id == "total_balance");
  CHECK(full[1].path.find("is_all=false") != std::string::npos);
  CHECK(full[1].path.find("chain_ids=") == std::string::npos);
  CHECK(full[0].max_attempts == 3);
  CHECK(full[0].max_body_bytes == 4 * 1024 * 1024);

  ruban::data::SyncOptions options;
  options.mode = ruban::data::SyncMode::incremental;
  options.chains = {{1, "eth"}, {8453, "base"}};
  const auto incremental = ruban::data::build_debank_request_plan(
      "0x0000000000000000000000000000000000000001", options);
  CHECK(incremental[1].path.find("chain_ids=eth,base") != std::string::npos);
  CHECK(incremental[2].path.find("chain_ids=eth,base") != std::string::npos);
}

TEST_CASE("incremental projections replace only selected chains") {
  ruban::data::SyncOptions options;
  options.mode = ruban::data::SyncMode::incremental;
  options.chains = {{8453, "base"}};
  const auto result = ruban::data::create_mock_debank_sync(
      "0x0000000000000000000000000000000000000001", 1000, options);
  REQUIRE(result.replace_chain_ids.size() == 1);
  CHECK(result.replace_chain_ids[0] == 8453);
  REQUIRE(result.projection.chains.size() == 1);
  CHECK(result.projection.chains[0].chain_key == "base");
  CHECK(result.projection.tokens.size() == 2);
  CHECK(result.projection.protocols.size() == 1);
  CHECK(result.projection.total_value_usd == doctest::Approx(1400.08));
}

TEST_CASE("retry policy is transient-only and bounded") {
  CHECK(ruban::data::retry_delay_ms(429, 1, 7000) == 5000);
  CHECK(ruban::data::retry_delay_ms(503, 1, -1) == 200);
  CHECK(ruban::data::retry_delay_ms(503, 2, -1) == 400);
  CHECK(ruban::data::retry_delay_ms(400, 1, -1) == -1);
  CHECK(ruban::data::retry_delay_ms(401, 1, -1) == -1);
  CHECK(ruban::data::retry_delay_ms(408, 1, -1) == 200);
  CHECK(ruban::data::retry_delay_ms(0, 1, -1) == 200);
  CHECK(ruban::data::retry_delay_ms(503, 3, -1) == -1);
}

TEST_CASE("invalid addresses and incremental selectors fail closed") {
  ruban::data::MockDeBankProvider provider;
  CHECK_THROWS_AS(provider.fetch("0x1234", 1000), std::invalid_argument);

  ruban::data::SyncOptions invalid;
  invalid.mode = ruban::data::SyncMode::incremental;
  CHECK_THROWS_AS(
      ruban::data::build_debank_request_plan(
          "0x0000000000000000000000000000000000000001", invalid),
      std::invalid_argument);
}

TEST_CASE("provider envelopes reject missing duplicate and failed endpoints") {
  const auto valid = payloads(
      R"({"total_usd_value":0,"chain_list":[]})");
  auto missing = valid;
  missing.pop_back();
  CHECK_THROWS_AS(ruban::data::parse_debank_payloads(
                      address, 1000, {}, missing, "debank:test"),
                  std::invalid_argument);

  auto duplicate = valid;
  duplicate[2].endpoint_id = "all_token_list";
  CHECK_THROWS_AS(ruban::data::parse_debank_payloads(
                      address, 1000, {}, duplicate, "debank:test"),
                  std::invalid_argument);

  auto unauthorized = valid;
  unauthorized[0].status_code = 401;
  CHECK_THROWS_AS(ruban::data::parse_debank_payloads(
                      address, 1000, {}, unauthorized, "debank:test"),
                  std::runtime_error);
}

TEST_CASE("provider JSON fails closed and preserves exact raw balances") {
  auto malformed = payloads(
      R"({"total_usd_value":0,"total_usd_value":1,"chain_list":[]})");
  CHECK_THROWS_AS(ruban::data::parse_debank_payloads(
                      address, 1000, {}, malformed, "debank:test"),
                  std::invalid_argument);

  const auto exact = ruban::data::parse_debank_payloads(
      address, 1000, {},
      payloads(
          R"({"total_usd_value":1,"chain_list":[{"id":"eth","community_id":1,"name":"Ethereum","usd_value":1}]})",
          R"([{"id":"eth","chain":"eth","name":"Ether","symbol":"ETH","decimals":18,"price":1,"amount":1,"raw_amount":900719925474099312345}])"),
      "debank:test");
  REQUIRE(exact.projection.tokens.size() == 1);
  CHECK(exact.projection.tokens[0].balance == "900719925474099312345");

  const auto derived = ruban::data::parse_debank_payloads(
      address, 1000, {},
      payloads(
          R"({"total_usd_value":1,"chain_list":[{"id":"eth","community_id":1,"name":"Ethereum","usd_value":1}]})",
          R"([{"id":"eth","chain":"eth","name":"Ether","symbol":"ETH","decimals":18,"price":1,"amount":0.123456789123456789}])"),
      "debank:test");
  REQUIRE(derived.projection.tokens.size() == 1);
  CHECK(derived.projection.tokens[0].balance == "123456789123456789");
}

TEST_CASE("incremental absence still requests a chain-scoped replacement") {
  ruban::data::SyncOptions options;
  options.mode = ruban::data::SyncMode::incremental;
  options.chains = {{10, "op"}};
  const auto result = ruban::data::parse_debank_payloads(
      address, 1000, options,
      payloads(R"({"total_usd_value":0,"chain_list":[]})"),
      "debank:test");
  REQUIRE(result.replace_chain_ids.size() == 1);
  CHECK(result.replace_chain_ids[0] == 10);
  CHECK(result.projection.chains.empty());
  CHECK(result.request_count == 3);
  CHECK(result.attempt_count == 3);
}

TEST_CASE("JSON envelopes enforce bounded integer fields") {
  const std::string options = R"({"mode":"full","chains":[]})";
  const std::string oversized_attempt =
      R"([{"endpointId":"total_balance","statusCode":200,"body":"{}","latencyMs":1,"attempts":2147483648}])";
  CHECK_THROWS_AS(ruban::data::create_debank_sync_result_json(
                      address, 1000, options, oversized_attempt, "debank:test"),
                  std::invalid_argument);
  CHECK_THROWS_AS(ruban::data::build_debank_request_plan_json(
                      address, R"({"mode":"incremental","chains":[]})"),
                  std::invalid_argument);
}
