/**
 * Metro configuration for React Native
 * https://github.com/facebook/react-native
 *
 * @format
 */

const {getDefaultConfig} = require('metro-config');

module.exports = (async () => {
  const {
    resolver: {assetExts, sourceExts},
  } = await getDefaultConfig();

  return {
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
      sourceExts: [...sourceExts, 'svg'],
    },
  };
})();
