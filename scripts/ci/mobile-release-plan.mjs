#!/usr/bin/env node

const regressionCells = [
  {
    era: '0.66',
    app: 'gongshu-0.66',
    arch: 'old',
    eraNode: 18,
    iosRunner: 'macos-14',
    xcode: 'oldest',
  },
  {
    era: '0.77',
    app: 'gongshu-0.77',
    arch: 'old',
    eraNode: 18,
    iosRunner: 'macos-14',
    xcode: 'default',
  },
  {
    era: '0.77',
    app: 'gongshu-0.77',
    arch: 'new',
    eraNode: 18,
    iosRunner: 'macos-14',
    xcode: 'default',
  },
  {
    era: 'latest',
    app: 'gongshu-latest',
    arch: 'new',
    eraNode: 22,
    iosRunner: 'macos-15',
    xcode: 'default',
  },
];

function androidRegression(cell) {
  return {
    id: `android-${cell.era}-${cell.arch}-regression`,
    platform: 'android',
    runner: 'ubuntu-latest',
    era: cell.era,
    app: cell.app,
    lane: 'regression',
    arch: cell.arch,
    distribution: 'internal',
    eraNode: cell.eraNode,
    xcode: 'none',
    testflight: false,
  };
}

function iosRegression(cell) {
  return {
    id: `ios-${cell.era}-${cell.arch}-regression`,
    platform: 'ios',
    runner: cell.iosRunner,
    era: cell.era,
    app: cell.app,
    lane: 'regression',
    arch: cell.arch,
    distribution: 'ad-hoc',
    eraNode: cell.eraNode,
    xcode: cell.xcode,
    testflight: false,
  };
}

const androidRegressionMatrix = regressionCells.map(androidRegression);
const iosRegressionMatrix = regressionCells.map(iosRegression);
const androidWebsite = {
  id: 'android-latest-new-production-website',
  platform: 'android',
  runner: 'ubuntu-latest',
  era: 'latest',
  app: 'gongshu-latest',
  lane: 'production',
  arch: 'new',
  distribution: 'website',
  eraNode: 22,
  xcode: 'none',
  testflight: false,
};
const androidPlay = {
  ...androidWebsite,
  id: 'android-latest-new-production-play',
  distribution: 'play',
};
const iosAppStore = {
  id: 'ios-latest-new-production-app-store',
  platform: 'ios',
  runner: 'macos-15',
  era: 'latest',
  app: 'gongshu-latest',
  lane: 'production',
  arch: 'new',
  distribution: 'app-store',
  eraNode: 22,
  xcode: 'app-store',
  testflight: false,
};

export const releaseTargets = Object.freeze({
  'all-packages': [
    ...androidRegressionMatrix,
    androidWebsite,
    androidPlay,
    ...iosRegressionMatrix,
    iosAppStore,
  ],
  'android-regression-matrix': androidRegressionMatrix,
  'ios-regression-matrix': iosRegressionMatrix,
  'android-latest-website': [androidWebsite],
  'android-latest-play': [androidPlay],
  'ios-latest-app-store': [iosAppStore],
  'ios-testflight': [{...iosAppStore, id: 'ios-latest-new-testflight', testflight: true}],
  'bootstrap-ci': [
    androidPlay,
    {...iosAppStore, id: 'ios-latest-new-testflight', testflight: true},
  ],
});

export function mobileReleasePlan(target) {
  const include = releaseTargets[target];
  if (!include) {
    throw new Error(
      `Unknown mobile release target '${target}'. Expected: ${Object.keys(releaseTargets).join(', ')}`,
    );
  }
  return {include};
}

const targetIndex = process.argv.indexOf('--target');
if (targetIndex !== -1) {
  const target = process.argv[targetIndex + 1];
  if (!target) throw new Error('--target requires a value');
  console.log(JSON.stringify(mobileReleasePlan(target)));
}
