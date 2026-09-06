#pragma once

#include <cstddef>
#include <cstdint>
#include <map>
#include <string>
#include <string_view>
#include <variant>
#include <vector>

namespace ruban::data::json {

class Value {
 public:
  using Array = std::vector<Value>;
  using Object = std::map<std::string, Value>;

  Value();
  explicit Value(bool value);
  explicit Value(std::string value);
  explicit Value(Array value);
  explicit Value(Object value);
  static Value number(std::string text, double value);

  bool is_null() const;
  bool is_bool() const;
  bool is_number() const;
  bool is_string() const;
  bool is_array() const;
  bool is_object() const;

  bool as_bool() const;
  double as_double() const;
  std::int64_t as_int64() const;
  const std::string& number_text() const;
  const std::string& as_string() const;
  const Array& as_array() const;
  const Object& as_object() const;
  const Value* find(std::string_view key) const;

 private:
  struct Number {
    std::string text;
    double value;
  };

  using Storage =
      std::variant<std::nullptr_t, bool, Number, std::string, Array, Object>;
  explicit Value(Number value);
  Storage storage_;
};

Value parse(std::string_view input, std::size_t max_depth = 64);

}
