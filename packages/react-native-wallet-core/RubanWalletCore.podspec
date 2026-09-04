require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |spec|
  spec.name = 'RubanWalletCore'
  spec.version = package['version']
  spec.summary = package['description']
  spec.homepage = package['homepage']
  spec.license = package['license']
  spec.authors = { 'Ruban Labs' => 'opensource@ruban-labs.work' }
  spec.platforms = { :ios => '12.4' }
  spec.source = { :git => package['repository']['url'], :tag => "#{spec.version}" }
  spec.source_files = 'ios/**/*.{h,m}'
  spec.public_header_files = 'ios/RubanWalletCore.h'
  spec.vendored_frameworks = 'ios/RubanWalletCore.xcframework'
  spec.frameworks = 'Security', 'UIKit'
  spec.pod_target_xcconfig = {
    'HEADER_SEARCH_PATHS' => '"${PODS_TARGET_SRCROOT}/rust/include"',
    'CLANG_CXX_LANGUAGE_STANDARD' => 'c++17'
  }
  spec.dependency 'React-Core'
end
