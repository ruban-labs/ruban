const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('node:path');

const chainAssetPrefix = '@ruban-labs/web-assets/assets/chains/';
const chainManifest = require.resolve(
  '@ruban-labs/web-assets/chain-assets.json',
);
const webAssetsRoot = path.resolve(path.dirname(chainManifest), '..');
const defaultConfig = getDefaultConfig(__dirname);
const { assetExts, sourceExts } = defaultConfig.resolver;

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  transformer: {
    babelTransformerPath: require.resolve(
      'react-native-svg-transformer/react-native',
    ),
  },
  resolver: {
    assetExts: assetExts.filter(extension => extension !== 'svg'),
    sourceExts: [...sourceExts, 'svg'],
    resolveRequest(context, moduleName, platform) {
      if (moduleName.startsWith(chainAssetPrefix)) {
        const assetName = moduleName.slice(chainAssetPrefix.length);
        if (!/^[a-z0-9-]+(?:-white)?\.png$/.test(assetName)) {
          throw new Error(`Invalid bundled chain asset: ${assetName}`);
        }
        return {
          type: 'sourceFile',
          filePath: path.join(webAssetsRoot, 'assets', 'chains', assetName),
        };
      }

      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(defaultConfig, config);
