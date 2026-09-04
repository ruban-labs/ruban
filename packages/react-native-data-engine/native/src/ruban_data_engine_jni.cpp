#include <jni.h>

#include <exception>
#include <stdexcept>
#include <string>

#include "ruban_data_engine.hpp"

namespace {

std::string from_jstring(JNIEnv* environment, jstring value) {
  if (value == nullptr) return {};
  const char* bytes = environment->GetStringUTFChars(value, nullptr);
  if (bytes == nullptr) return {};
  std::string result(bytes);
  environment->ReleaseStringUTFChars(value, bytes);
  return result;
}

void throw_java(JNIEnv* environment, const char* class_name,
                const char* message) {
  jclass exception_class = environment->FindClass(class_name);
  if (exception_class != nullptr) {
    environment->ThrowNew(exception_class, message);
  }
}

}

extern "C" JNIEXPORT jstring JNICALL
Java_com_rubanlabs_dataengine_RubanDataEngineBindings_createMockProjectionJson(
    JNIEnv* environment, jclass, jstring address, jlong observed_at) {
  try {
    const ruban::data::MockDeBankProvider provider;
    const auto projection = provider.fetch(from_jstring(environment, address),
                                           observed_at);
    const auto json = ruban::data::serialize_projection_json(projection);
    return environment->NewStringUTF(json.c_str());
  } catch (const std::invalid_argument& error) {
    throw_java(environment, "java/lang/IllegalArgumentException", error.what());
  } catch (const std::exception&) {
    throw_java(environment, "java/lang/RuntimeException", "data_engine_failed");
  }
  return nullptr;
}
