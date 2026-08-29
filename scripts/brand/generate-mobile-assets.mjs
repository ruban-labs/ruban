#!/usr/bin/env node

import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const checkOnly = process.argv.includes('--check');
const config = JSON.parse(
  await readFile(resolve(repoRoot, 'brand/mobile-assets.json'), 'utf8'),
);

if (config.schemaVersion !== 1) {
  throw new Error(`Unsupported mobile asset schema: ${config.schemaVersion}`);
}

const appIconSource = await readFile(
  resolve(repoRoot, 'brand/ruban-app-icon-dark.svg'),
  'utf8',
);
const coreSource = await readFile(
  resolve(repoRoot, 'brand/ruban-core.svg'),
  'utf8',
);
const expectedFiles = new Map();

const densities = [
  ['mdpi', 1],
  ['hdpi', 1.5],
  ['xhdpi', 2],
  ['xxhdpi', 3],
  ['xxxhdpi', 4],
];

const iosIconSlots = [
  ['iphone', '20x20', '2x', 40, 'icon-iphone-20@2x.png'],
  ['iphone', '20x20', '3x', 60, 'icon-iphone-20@3x.png'],
  ['iphone', '29x29', '2x', 58, 'icon-iphone-29@2x.png'],
  ['iphone', '29x29', '3x', 87, 'icon-iphone-29@3x.png'],
  ['iphone', '40x40', '2x', 80, 'icon-iphone-40@2x.png'],
  ['iphone', '40x40', '3x', 120, 'icon-iphone-40@3x.png'],
  ['iphone', '60x60', '2x', 120, 'icon-iphone-60@2x.png'],
  ['iphone', '60x60', '3x', 180, 'icon-iphone-60@3x.png'],
  ['ipad', '20x20', '1x', 20, 'icon-ipad-20.png'],
  ['ipad', '20x20', '2x', 40, 'icon-ipad-20@2x.png'],
  ['ipad', '29x29', '1x', 29, 'icon-ipad-29.png'],
  ['ipad', '29x29', '2x', 58, 'icon-ipad-29@2x.png'],
  ['ipad', '40x40', '1x', 40, 'icon-ipad-40.png'],
  ['ipad', '40x40', '2x', 80, 'icon-ipad-40@2x.png'],
  ['ipad', '76x76', '1x', 76, 'icon-ipad-76.png'],
  ['ipad', '76x76', '2x', 152, 'icon-ipad-76@2x.png'],
  ['ipad', '83.5x83.5', '2x', 167, 'icon-ipad-83.5@2x.png'],
  ['ios-marketing', '1024x1024', '1x', 1024, 'icon-marketing-1024.png'],
];

function queueText(relativePath, value) {
  expectedFiles.set(resolve(repoRoot, relativePath), {
    kind: 'text',
    value: Buffer.from(value),
  });
}

function queuePng(relativePath, value) {
  expectedFiles.set(resolve(repoRoot, relativePath), {
    kind: 'png',
    value,
  });
}

function replaceColor(svg, sourceColor, targetColor) {
  return svg.replaceAll(sourceColor.toLowerCase(), targetColor.toLowerCase());
}

function recolorAppIcon(channel) {
  let svg = appIconSource.replace(
    /(<svg[^>]*>)/,
    `$1\n  <rect width="96" height="96" fill="${channel.tile}"/>`,
  );
  svg = replaceColor(svg, '#101114', channel.tile);
  svg = replaceColor(svg, '#ffffff', channel.mark);
  return replaceColor(svg, '#4c8dff', channel.accent);
}

function recolorCore(mark, accent) {
  return replaceColor(
    replaceColor(coreSource, '#d9ff45', mark),
    '#2563eb',
    accent,
  );
}

function roundLegacyIcon(channel) {
  const paths = recolorAppIcon(channel).match(/<path[\s\S]*?\/>/g);
  if (!paths || paths.length !== 2) {
    throw new Error('ruban-app-icon-dark.svg must contain exactly two paths');
  }

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">',
    `  <circle cx="48" cy="48" r="48" fill="${channel.tile}"/>`,
    ...paths.map(path => `  ${path}`),
    '</svg>',
  ].join('\n');
}

function adaptiveForeground(channel) {
  const core = recolorCore(channel.mark, channel.accent);
  const paths = core.match(/<path[\s\S]*?\/>/g);
  if (!paths || paths.length !== 2) {
    throw new Error('ruban-core.svg must contain exactly two paths');
  }

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">',
    '  <g transform="translate(21 21) scale(.6875)">',
    ...paths.map(path => `    ${path}`),
    '  </g>',
    '</svg>',
  ].join('\n');
}

async function renderPng(svg, width, height = width) {
  return sharp(Buffer.from(svg))
    .resize(width, height, {fit: 'fill'})
    .png({compressionLevel: 9})
    .toBuffer();
}

async function renderAndroidLaunchPng(svg, logoSize, scale) {
  const canvasSize = Math.round(288 * scale);
  const markSize = Math.round(logoSize * scale);
  const offset = Math.round((canvasSize - markSize) / 2);
  const mark = await renderPng(svg, markSize);

  return sharp({
    create: {
      width: canvasSize,
      height: canvasSize,
      channels: 4,
      background: {r: 0, g: 0, b: 0, alpha: 0},
    },
  })
    .composite([{input: mark, left: offset, top: offset}])
    .png({compressionLevel: 9})
    .toBuffer();
}

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function colorComponents(hex) {
  const value = hex.slice(1);
  return [0, 2, 4].map(offset =>
    (Number.parseInt(value.slice(offset, offset + 2), 16) / 255).toFixed(6),
  );
}

function launchStoryboard(background, logoSize) {
  const [red, green, blue] = colorComponents(background);
  const logoOriginX = (414 - logoSize) / 2;
  const logoOriginY = (896 - logoSize) / 2;
  return `<?xml version="1.0" encoding="UTF-8"?>
<document type="com.apple.InterfaceBuilder3.CocoaTouch.Storyboard.XIB" version="3.0" toolsVersion="15702" targetRuntime="iOS.CocoaTouch" propertyAccessControl="none" useAutolayout="YES" launchScreen="YES" useTraitCollections="YES" colorMatched="YES" initialViewController="ruban-view-controller">
    <device id="retina6_1" orientation="portrait" appearance="light"/>
    <dependencies>
        <deployment identifier="iOS"/>
        <plugIn identifier="com.apple.InterfaceBuilder.IBCocoaTouchPlugin" version="15704"/>
        <capability name="documents saved in the Xcode 8 format" minToolsVersion="8.0"/>
    </dependencies>
    <scenes>
        <scene sceneID="ruban-launch-scene">
            <objects>
                <viewController id="ruban-view-controller" sceneMemberID="viewController">
                    <view key="view" contentMode="scaleToFill" id="ruban-launch-view">
                        <rect key="frame" x="0.0" y="0.0" width="414" height="896"/>
                        <autoresizingMask key="autoresizingMask" widthSizable="YES" heightSizable="YES"/>
                        <subviews>
                            <imageView clipsSubviews="YES" userInteractionEnabled="NO" contentMode="scaleAspectFit" image="LaunchMark" translatesAutoresizingMaskIntoConstraints="NO" id="ruban-launch-mark">
                                <rect key="frame" x="${logoOriginX}" y="${logoOriginY}" width="${logoSize}" height="${logoSize}"/>
                                <constraints>
                                    <constraint firstAttribute="width" constant="${logoSize}" id="ruban-mark-width"/>
                                    <constraint firstAttribute="height" constant="${logoSize}" id="ruban-mark-height"/>
                                </constraints>
                            </imageView>
                        </subviews>
                        <color key="backgroundColor" red="${red}" green="${green}" blue="${blue}" alpha="1" colorSpace="custom" customColorSpace="sRGB"/>
                        <constraints>
                            <constraint firstItem="ruban-launch-mark" firstAttribute="centerX" secondItem="ruban-launch-view" secondAttribute="centerX" id="ruban-mark-center-x"/>
                            <constraint firstItem="ruban-launch-mark" firstAttribute="centerY" secondItem="ruban-launch-view" secondAttribute="centerY" id="ruban-mark-center-y"/>
                        </constraints>
                    </view>
                </viewController>
                <placeholder placeholderIdentifier="IBFirstResponder" id="ruban-first-responder" sceneMemberID="firstResponder"/>
            </objects>
        </scene>
    </scenes>
    <resources>
        <image name="LaunchMark" width="${logoSize}" height="${logoSize}"/>
    </resources>
</document>
`;
}

function androidColorResources(channel, launch) {
  const launchColor = launch
    ? `\n    <color name="ruban_launch_background">${launch.background}</color>`
    : '';
  return `<resources>
    <color name="ruban_launcher_background">${channel.tile}</color>${launchColor}
</resources>
`;
}

function androidAdaptiveIcon(includeMonochrome) {
  const monochrome = includeMonochrome
    ? '\n    <monochrome android:drawable="@drawable/ic_launcher_monochrome"/>'
    : '';
  return `<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ruban_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>${monochrome}
</adaptive-icon>
`;
}

function androidMonochromeVector() {
  const path = coreSource.match(/<path[^>]*d="([^"]+)"[^>]*\/>/);
  if (!path) {
    throw new Error('ruban-core.svg must contain a primary path');
  }

  return `<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportHeight="108">
    <group android:translateX="21" android:translateY="21" android:scaleX="0.6875" android:scaleY="0.6875">
        <path android:fillColor="#FFFFFFFF" android:fillType="evenOdd" android:pathData="${path[1]}"/>
    </group>
</vector>
`;
}

function androidLaunchStyles(app) {
  if (app.androidBootSplashTheme === 'androidx-core') {
    return `<resources>
    <style name="BootTheme" parent="Theme.SplashScreen">
        <item name="windowSplashScreenBackground">@color/ruban_launch_background</item>
        <item name="windowSplashScreenAnimatedIcon">@drawable/ruban_launch_mark</item>
        <item name="postSplashScreenTheme">@style/AppTheme</item>
        <item name="android:statusBarColor">@color/ruban_launch_background</item>
        <item name="android:navigationBarColor">@color/ruban_launch_background</item>
        <item name="android:windowLightStatusBar">false</item>
        <item name="android:windowLightNavigationBar">false</item>
    </style>
</resources>
`;
  }

  return `<resources>
    <style name="BootTheme" parent="Theme.BootSplash">
        <item name="bootSplashBackground">@color/ruban_launch_background</item>
        <item name="bootSplashLogo">@drawable/ruban_launch_mark</item>
        <item name="postBootSplashTheme">@style/AppTheme</item>
        <item name="darkContentBarsStyle">false</item>
    </style>
</resources>
`;
}

async function generateIosAssets(app, channelName, channel, iconSvg) {
  const appIconRoot = `${app.iosAssets}/${channel.iosAppIcon}.appiconset`;
  const images = [];

  for (const [idiom, size, scale, pixels, filename] of iosIconSlots) {
    queuePng(`${appIconRoot}/${filename}`, await renderPng(iconSvg, pixels));
    images.push({filename, idiom, scale, size});
  }

  queueText(
    `${appIconRoot}/Contents.json`,
    json({images, info: {author: 'ruban', version: 1}}),
  );
  process.stdout.write(`  iOS ${app.name} ${channelName}\n`);
}

async function generateAndroidAssets(app, channelName, channel, iconSvg) {
  const sourceRoot = `${app.root}/android/app/src/${channel.androidSourceSet}/res`;
  const roundSvg = roundLegacyIcon(channel);
  const foregroundSvg = adaptiveForeground(channel);

  for (const [density, scale] of densities) {
    const mipmapRoot = `${sourceRoot}/mipmap-${density}`;
    queuePng(
      `${mipmapRoot}/ic_launcher.png`,
      await renderPng(iconSvg, Math.round(48 * scale)),
    );
    queuePng(
      `${mipmapRoot}/ic_launcher_round.png`,
      await renderPng(roundSvg, Math.round(48 * scale)),
    );
    queuePng(
      `${mipmapRoot}/ic_launcher_foreground.png`,
      await renderPng(foregroundSvg, Math.round(108 * scale)),
    );
  }

  queueText(
    `${sourceRoot}/values/ruban_brand_colors.xml`,
    androidColorResources(channel, channelName === 'production' ? config.launch : null),
  );
  process.stdout.write(`  Android ${app.name} ${channelName}\n`);
}

async function generateSharedAppAssets(app, launchSvg) {
  const logoSize = config.launch.logoSize;
  const launchImageRoot = `${app.iosAssets}/LaunchMark.imageset`;
  const launchImages = [];
  for (const [scale, pixels, filename] of [
    ['1x', logoSize, 'launch-mark.png'],
    ['2x', logoSize * 2, 'launch-mark@2x.png'],
    ['3x', logoSize * 3, 'launch-mark@3x.png'],
  ]) {
    queuePng(`${launchImageRoot}/${filename}`, await renderPng(launchSvg, pixels));
    launchImages.push({filename, idiom: 'universal', scale});
  }
  queueText(
    `${launchImageRoot}/Contents.json`,
    json({images: launchImages, info: {author: 'ruban', version: 1}}),
  );
  queueText(
    app.iosLaunchStoryboard,
    launchStoryboard(config.launch.background, logoSize),
  );

  for (const [density, scale] of densities) {
    queuePng(
      `${app.root}/android/app/src/main/res/drawable-${density}/ruban_launch_mark.png`,
      await renderAndroidLaunchPng(launchSvg, logoSize, scale),
    );
  }

  const mainAndroidResources = `${app.root}/android/app/src/main/res`;
  queueText(
    `${mainAndroidResources}/drawable/ic_launcher_monochrome.xml`,
    androidMonochromeVector(),
  );
  for (const name of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
    queueText(
      `${mainAndroidResources}/mipmap-anydpi-v26/${name}`,
      androidAdaptiveIcon(false),
    );
    queueText(
      `${mainAndroidResources}/mipmap-anydpi-v33/${name}`,
      androidAdaptiveIcon(true),
    );
  }
  queueText(
    `${mainAndroidResources}/values/ruban_launch_styles.xml`,
    androidLaunchStyles(app),
  );
  queueText(
    `${mainAndroidResources}/values-v31/ruban_launch_styles.xml`,
    androidLaunchStyles(app),
  );
}

async function samePng(actual, expected) {
  const [actualImage, expectedImage] = await Promise.all([
    sharp(actual).ensureAlpha().raw().toBuffer({resolveWithObject: true}),
    sharp(expected).ensureAlpha().raw().toBuffer({resolveWithObject: true}),
  ]);
  return (
    actualImage.info.width === expectedImage.info.width &&
    actualImage.info.height === expectedImage.info.height &&
    actualImage.info.channels === expectedImage.info.channels &&
    actualImage.data.equals(expectedImage.data)
  );
}

async function flushExpectedFiles() {
  const mismatches = [];
  for (const [absolutePath, expected] of expectedFiles) {
    if (!checkOnly) {
      await mkdir(dirname(absolutePath), {recursive: true});
      await writeFile(absolutePath, expected.value);
      continue;
    }

    try {
      const actual = await readFile(absolutePath);
      const equal =
        expected.kind === 'png'
          ? await samePng(actual, expected.value)
          : actual.equals(expected.value);
      if (!equal) {
        mismatches.push(absolutePath);
      }
    } catch {
      mismatches.push(absolutePath);
    }
  }

  if (mismatches.length > 0) {
    const relativePaths = mismatches.map(path => path.slice(repoRoot.length + 1));
    throw new Error(
      `Generated mobile assets are stale:\n${relativePaths
        .map(path => `- ${path}`)
        .join('\n')}`,
    );
  }
}

const launchSvg = recolorCore(config.launch.mark, config.launch.accent);
for (const app of config.apps) {
  await generateSharedAppAssets(app, launchSvg);
  for (const [channelName, channel] of Object.entries(config.channels)) {
    const iconSvg = recolorAppIcon(channel);
    await generateIosAssets(app, channelName, channel, iconSvg);
    await generateAndroidAssets(app, channelName, channel, iconSvg);
  }
}

await flushExpectedFiles();
process.stdout.write(
  `${checkOnly ? 'Verified' : 'Generated'} ${expectedFiles.size} mobile brand files.\n`,
);
