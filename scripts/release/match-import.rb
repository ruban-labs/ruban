#!/usr/bin/env ruby

require 'optparse'
require 'fastlane'
require 'match/importer'
require 'match/options'

options = {}
OptionParser.new do |parser|
  parser.on('--type TYPE') { |value| options[:type] = value }
  parser.on('--certificate PATH') { |value| options[:certificate] = value }
  parser.on('--private-key PATH') { |value| options[:private_key] = value }
  parser.on('--profile PATH') { |value| options[:profile] = value }
end.parse!

required = %i[type certificate private_key profile]
missing = required.reject { |key| options[key] && !options[key].empty? }
abort("missing options: #{missing.join(', ')}") unless missing.empty?

api_key = {
  key_id: ENV.fetch('RUBAN_ASC_KEY_ID', '422928A7U6'),
  issuer_id: ENV.fetch('RUBAN_ASC_ISSUER_ID', '25b9a32a-8681-4697-8a7e-d67d5f88f872'),
  key: File.binread(ENV.fetch('RUBAN_ASC_KEY_PATH')),
  duration: 1200,
  in_house: false
}

params = FastlaneCore::Configuration.create(
  Match::Options.available_options,
  {
    type: options.fetch(:type),
    api_key: api_key,
    team_id: 'X4CK8ZXA45',
    storage_mode: 'git',
    git_url: 'https://github.com/ruban-labs/apple-certs.git',
    git_branch: 'main',
    platform: 'ios'
  }
)
params.load_configuration_file('Matchfile')

Match::Importer.new.import_cert(
  params,
  cert_path: options.fetch(:certificate),
  p12_path: options.fetch(:private_key),
  profile_path: options.fetch(:profile)
)
