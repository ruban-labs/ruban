// RN 0.66 CLI reads the app package name from the manifest `package` attribute,
// which AGP 8 forbids (namespace lives in build.gradle instead).
// Provide it explicitly so `react-native config` / autolinking keep working.
module.exports = {
  project: {
    android: {
      packageName: 'com.gongshu066',
    },
  },
};
