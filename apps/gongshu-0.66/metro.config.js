/**
 * Metro configuration for React Native
 * https://github.com/facebook/react-native
 *
 * @format
 */

const fs = require('fs');
const path = require('path');
const {getDefaultConfig} = require('metro-config');

const packageManifest = require('./package.json');
const linkedDependencies = Object.keys({
  ...packageManifest.dependencies,
  ...packageManifest.devDependencies,
}).reduce(
  (result, packageName) => {
    const packagePath = path.join(__dirname, 'node_modules', packageName);

    try {
      if (fs.lstatSync(packagePath).isSymbolicLink()) {
        result[packageName] = fs.realpathSync(packagePath);
      }
    } catch (_error) {}

    return result;
  },
  {},
);

module.exports = (async () => {
  const {
    resolver: {assetExts, sourceExts},
  } = await getDefaultConfig();

  return {
    watchFolders: Object.values(linkedDependencies),
    transformer: {
      babelTransformerPath: require.resolve(
        'react-native-svg-transformer/react-native',
      ),
      getTransformOptions: async () => ({
        transform: {
          experimentalImportSupport: false,
          inlineRequires: true,
        },
      }),
    },
    resolver: {
      assetExts: assetExts.filter(extension => extension !== 'svg'),
      extraNodeModules: linkedDependencies,
      sourceExts: [...sourceExts, 'svg'],
    },
  };
})();
