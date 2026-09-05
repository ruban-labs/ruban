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
Java_com_rubanlabs_dataengine_RubanDataEngineBindings_createMockSyncResultJson(
    JNIEnv* environment, jclass, jstring address, jlong observed_at,
    jstring options_json) {
  try {
    const auto json = ruban::data::create_mock_debank_sync_result_json(
        from_jstring(environment, address), observed_at,
        from_jstring(environment, options_json));
    return environment->NewStringUTF(json.c_str());
  } catch (const std::invalid_argument& error) {
    throw_java(environment, "java/lang/IllegalArgumentException", error.what());
  } catch (const std::exception& error) {
    throw_java(environment, "java/lang/RuntimeException", error.what());
  }
  return nullptr;
}

extern "C" JNIEXPORT jstring JNICALL
Java_com_rubanlabs_dataengine_RubanDataEngineBindings_createDeBankRequestPlanJson(
    JNIEnv* environment, jclass, jstring address, jstring options_json) {
  try {
    const auto json = ruban::data::build_debank_request_plan_json(
        from_jstring(environment, address),
        from_jstring(environment, options_json));
    return environment->NewStringUTF(json.c_str());
  } catch (const std::invalid_argument& error) {
    throw_java(environment, "java/lang/IllegalArgumentException", error.what());
  } catch (const std::exception& error) {
    throw_java(environment, "java/lang/RuntimeException", error.what());
  }
  return nullptr;
}

extern "C" JNIEXPORT jstring JNICALL
Java_com_rubanlabs_dataengine_RubanDataEngineBindings_createDeBankSyncResultJson(
    JNIEnv* environment, jclass, jstring address, jlong observed_at,
    jstring options_json, jstring payloads_json, jstring source) {
  try {
    const auto json = ruban::data::create_debank_sync_result_json(
        from_jstring(environment, address), observed_at,
        from_jstring(environment, options_json),
        from_jstring(environment, payloads_json),
        from_jstring(environment, source));
    return environment->NewStringUTF(json.c_str());
  } catch (const std::invalid_argument& error) {
    throw_java(environment, "java/lang/IllegalArgumentException", error.what());
  } catch (const std::exception& error) {
    throw_java(environment, "java/lang/RuntimeException", error.what());
  }
  return nullptr;
}

extern "C" JNIEXPORT jlong JNICALL
Java_com_rubanlabs_dataengine_RubanDataEngineBindings_retryDelayMs(
    JNIEnv*, jclass, jint status_code, jint completed_attempts,
    jlong retry_after_ms, jint max_attempts) {
  return ruban::data::retry_delay_ms(status_code, completed_attempts,
                                     retry_after_ms, max_attempts);
}
