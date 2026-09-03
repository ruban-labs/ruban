module.exports = {
  preset: '@react-native/jest-preset',
  moduleNameMapper: {
    '^@ruban-labs/web-assets/assets/chains/(.*)$':
      '<rootDir>/node_modules/@ruban-labs/web-assets/assets/chains/$1',
    '^@ruban-labs/web3-tx-parser$':
      '<rootDir>/node_modules/@ruban-labs/web3-tx-parser/dist/index.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((@)?react-native|@react-native(-community)?|@ruban-labs)/)',
  ],
};
