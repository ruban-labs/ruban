require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |spec|
  spec.name = 'RubanDataEngine'
  spec.version = package['version']
  spec.summary = package['description']
  spec.homepage = package['homepage']
  spec.license = package['license']
  spec.authors = { 'Ruban Labs' => 'opensource@ruban-labs.work' }
  spec.platforms = { :ios => '12.4' }
  spec.source = { :git => package['repository']['url'], :tag => "#{spec.version}" }
  spec.source_files = 'ios/**/*.{h,mm}',
                      'native/include/**/*.hpp',
                      'native/src/ruban_data_engine.cpp',
                      'native/src/ruban_json.cpp',
                      'native/src/debank_provider.cpp'
  spec.public_header_files = 'ios/RubanDataEngine.h'
  spec.libraries = 'sqlite3'
  spec.frameworks = 'Security'
  spec.pod_target_xcconfig = {
    'HEADER_SEARCH_PATHS' => '"${PODS_TARGET_SRCROOT}/native/include"',
    'CLANG_CXX_LANGUAGE_STANDARD' => 'c++17'
  }
  spec.dependency 'React-Core'
end
