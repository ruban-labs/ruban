cmake_minimum_required(VERSION 3.13)
project(ruban_data_engine LANGUAGES CXX)

add_library(
  ruban_data_engine
  SHARED
  ../native/src/ruban_data_engine.cpp
  ../native/src/ruban_data_engine_jni.cpp
)

target_include_directories(
  ruban_data_engine
  PRIVATE
  ../native/include
)

target_compile_features(ruban_data_engine PRIVATE cxx_std_17)
target_link_options(ruban_data_engine PRIVATE "-Wl,-z,max-page-size=16384")
target_link_libraries(ruban_data_engine log)
