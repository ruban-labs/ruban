require 'openssl'

source_path, output_path, friendly_name = ARGV
abort 'expected source, output, and friendly name' unless ARGV.length == 3

password = STDIN.read
abort 'invalid PKCS12 output password' unless password.match?(/\A[A-Za-z0-9_-]{43}\z/)

source = OpenSSL::PKCS12.new(File.binread(source_path), '')
output = OpenSSL::PKCS12.create(
  password,
  friendly_name,
  source.key,
  source.certificate,
  source.ca_certs,
)

File.binwrite(output_path, output.to_der)
File.chmod(0o600, output_path)
