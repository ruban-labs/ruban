#include "ruban_json.hpp"

#include <cerrno>
#include <charconv>
#include <cmath>
#include <cstdlib>
#include <limits>
#include <stdexcept>
#include <utility>

namespace ruban::data::json {
namespace {

[[noreturn]] void fail() { throw std::invalid_argument("invalid_json"); }

void append_utf8(std::string& output, std::uint32_t codepoint) {
  if (codepoint <= 0x7f) {
    output.push_back(static_cast<char>(codepoint));
  } else if (codepoint <= 0x7ff) {
    output.push_back(static_cast<char>(0xc0 | (codepoint >> 6)));
    output.push_back(static_cast<char>(0x80 | (codepoint & 0x3f)));
  } else if (codepoint <= 0xffff) {
    output.push_back(static_cast<char>(0xe0 | (codepoint >> 12)));
    output.push_back(static_cast<char>(0x80 | ((codepoint >> 6) & 0x3f)));
    output.push_back(static_cast<char>(0x80 | (codepoint & 0x3f)));
  } else if (codepoint <= 0x10ffff) {
    output.push_back(static_cast<char>(0xf0 | (codepoint >> 18)));
    output.push_back(static_cast<char>(0x80 | ((codepoint >> 12) & 0x3f)));
    output.push_back(static_cast<char>(0x80 | ((codepoint >> 6) & 0x3f)));
    output.push_back(static_cast<char>(0x80 | (codepoint & 0x3f)));
  } else {
    fail();
  }
}

class Parser {
 public:
  Parser(std::string_view input, std::size_t max_depth)
      : input_(input), max_depth_(max_depth) {}

  Value run() {
    skip_whitespace();
    Value result = parse_value(0);
    skip_whitespace();
    if (position_ != input_.size()) fail();
    return result;
  }

 private:
  Value parse_value(std::size_t depth) {
    if (depth > max_depth_ || position_ >= input_.size()) fail();
    switch (input_[position_]) {
      case 'n':
        consume_literal("null");
        return Value();
      case 't':
        consume_literal("true");
        return Value(true);
      case 'f':
        consume_literal("false");
        return Value(false);
      case '"':
        return Value(parse_string());
      case '[':
        return parse_array(depth + 1);
      case '{':
        return parse_object(depth + 1);
      default:
        return parse_number();
    }
  }

  Value parse_array(std::size_t depth) {
    ++position_;
    Value::Array values;
    skip_whitespace();
    if (consume(']')) return Value(std::move(values));
    while (true) {
      skip_whitespace();
      values.push_back(parse_value(depth));
      skip_whitespace();
      if (consume(']')) return Value(std::move(values));
      if (!consume(',')) fail();
    }
  }

  Value parse_object(std::size_t depth) {
    ++position_;
    Value::Object values;
    skip_whitespace();
    if (consume('}')) return Value(std::move(values));
    while (true) {
      skip_whitespace();
      if (position_ >= input_.size() || input_[position_] != '"') fail();
      std::string key = parse_string();
      skip_whitespace();
      if (!consume(':')) fail();
      skip_whitespace();
      auto inserted = values.emplace(std::move(key), parse_value(depth));
      if (!inserted.second) fail();
      skip_whitespace();
      if (consume('}')) return Value(std::move(values));
      if (!consume(',')) fail();
    }
  }

  Value parse_number() {
    const std::size_t start = position_;
    consume('-');
    if (consume('0')) {
      if (position_ < input_.size() && input_[position_] >= '0' &&
          input_[position_] <= '9') {
        fail();
      }
    } else {
      if (!consume_digits()) fail();
    }
    if (consume('.')) {
      if (!consume_digits()) fail();
    }
    if (consume('e') || consume('E')) {
      consume('+') || consume('-');
      if (!consume_digits()) fail();
    }
    if (position_ == start) fail();
    std::string text(input_.substr(start, position_ - start));
    char* end = nullptr;
    errno = 0;
    const double value = std::strtod(text.c_str(), &end);
    if (errno == ERANGE || end != text.c_str() + text.size() ||
        !std::isfinite(value)) {
      fail();
    }
    return Value::number(std::move(text), value);
  }

  std::string parse_string() {
    if (!consume('"')) fail();
    std::string output;
    while (position_ < input_.size()) {
      const unsigned char character =
          static_cast<unsigned char>(input_[position_++]);
      if (character == '"') return output;
      if (character < 0x20) fail();
      if (character != '\\') {
        output.push_back(static_cast<char>(character));
        continue;
      }
      if (position_ >= input_.size()) fail();
      switch (input_[position_++]) {
        case '"': output.push_back('"'); break;
        case '\\': output.push_back('\\'); break;
        case '/': output.push_back('/'); break;
        case 'b': output.push_back('\b'); break;
        case 'f': output.push_back('\f'); break;
        case 'n': output.push_back('\n'); break;
        case 'r': output.push_back('\r'); break;
        case 't': output.push_back('\t'); break;
        case 'u': {
          std::uint32_t codepoint = parse_hex4();
          if (codepoint >= 0xd800 && codepoint <= 0xdbff) {
            if (!consume('\\') || !consume('u')) fail();
            const std::uint32_t low = parse_hex4();
            if (low < 0xdc00 || low > 0xdfff) fail();
            codepoint = 0x10000 + ((codepoint - 0xd800) << 10) +
                        (low - 0xdc00);
          } else if (codepoint >= 0xdc00 && codepoint <= 0xdfff) {
            fail();
          }
          append_utf8(output, codepoint);
          break;
        }
        default:
          fail();
      }
    }
    fail();
  }

  std::uint32_t parse_hex4() {
    std::uint32_t value = 0;
    for (int index = 0; index < 4; ++index) {
      if (position_ >= input_.size()) fail();
      const char character = input_[position_++];
      value <<= 4;
      if (character >= '0' && character <= '9') value += character - '0';
      else if (character >= 'a' && character <= 'f') value += character - 'a' + 10;
      else if (character >= 'A' && character <= 'F') value += character - 'A' + 10;
      else fail();
    }
    return value;
  }

  bool consume_digits() {
    const std::size_t start = position_;
    while (position_ < input_.size() && input_[position_] >= '0' &&
           input_[position_] <= '9') {
      ++position_;
    }
    return position_ > start;
  }

  void consume_literal(std::string_view literal) {
    if (input_.substr(position_, literal.size()) != literal) fail();
    position_ += literal.size();
  }

  bool consume(char expected) {
    if (position_ < input_.size() && input_[position_] == expected) {
      ++position_;
      return true;
    }
    return false;
  }

  void skip_whitespace() {
    while (position_ < input_.size()) {
      const char character = input_[position_];
      if (character != ' ' && character != '\n' && character != '\r' &&
          character != '\t') {
        return;
      }
      ++position_;
    }
  }

  std::string_view input_;
  std::size_t max_depth_;
  std::size_t position_ = 0;
};

}

Value::Value() : storage_(nullptr) {}
Value::Value(bool value) : storage_(value) {}
Value::Value(Number value) : storage_(std::move(value)) {}
Value::Value(std::string value) : storage_(std::move(value)) {}
Value::Value(Array value) : storage_(std::move(value)) {}
Value::Value(Object value) : storage_(std::move(value)) {}

Value Value::number(std::string text, double value) {
  return Value(Number{std::move(text), value});
}

bool Value::is_null() const { return std::holds_alternative<std::nullptr_t>(storage_); }
bool Value::is_bool() const { return std::holds_alternative<bool>(storage_); }
bool Value::is_number() const { return std::holds_alternative<Number>(storage_); }
bool Value::is_string() const { return std::holds_alternative<std::string>(storage_); }
bool Value::is_array() const { return std::holds_alternative<Array>(storage_); }
bool Value::is_object() const { return std::holds_alternative<Object>(storage_); }

bool Value::as_bool() const {
  if (!is_bool()) fail();
  return std::get<bool>(storage_);
}

double Value::as_double() const {
  if (!is_number()) fail();
  return std::get<Number>(storage_).value;
}

std::int64_t Value::as_int64() const {
  if (!is_number()) fail();
  const std::string& text = number_text();
  std::int64_t value = 0;
  const auto result = std::from_chars(text.data(), text.data() + text.size(), value);
  if (result.ec != std::errc() || result.ptr != text.data() + text.size()) fail();
  return value;
}

const std::string& Value::number_text() const {
  if (!is_number()) fail();
  return std::get<Number>(storage_).text;
}

const std::string& Value::as_string() const {
  if (!is_string()) fail();
  return std::get<std::string>(storage_);
}

const Value::Array& Value::as_array() const {
  if (!is_array()) fail();
  return std::get<Array>(storage_);
}

const Value::Object& Value::as_object() const {
  if (!is_object()) fail();
  return std::get<Object>(storage_);
}

const Value* Value::find(std::string_view key) const {
  if (!is_object()) fail();
  const auto& object = std::get<Object>(storage_);
  const auto iterator = object.find(std::string(key));
  return iterator == object.end() ? nullptr : &iterator->second;
}

Value parse(std::string_view input, std::size_t max_depth) {
  return Parser(input, max_depth).run();
}

}
