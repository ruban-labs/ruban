const path = require('path');

module.exports = {
  dependency: {
    platforms: {
      ios: {
        project: 'ios',
        podspecPath: path.join(__dirname, 'RubanWalletCore.podspec'),
      },
      android: {
        sourceDir: './android',
        packageImportPath: 'import com.rubanlabs.walletcore.RubanWalletCorePackage;',
        packageInstance: 'new RubanWalletCorePackage()',
      },
    },
  },
};
