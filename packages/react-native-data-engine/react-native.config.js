const path = require('path');

module.exports = {
  dependency: {
    platforms: {
      ios: {
        project: 'ios',
        podspecPath: path.join(__dirname, 'RubanDataEngine.podspec'),
      },
      android: {
        sourceDir: './android',
        packageImportPath:
          'import com.rubanlabs.dataengine.RubanDataEnginePackage;',
        packageInstance: 'new RubanDataEnginePackage()',
      },
    },
  },
};
