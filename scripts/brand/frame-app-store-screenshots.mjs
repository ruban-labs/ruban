#!/usr/bin/env node

import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sourceRoot = resolve(
  repoRoot,
  'brand/store-assets/app-store/iphone-6.5-screenshots-native',
);
const outputRoot = resolve(
  repoRoot,
  'brand/store-assets/app-store/iphone-6.5-screenshots',
);
const checkOnly = process.argv.includes('--check');
const target = {width: 1242, height: 2688};
const screenshotNames = [
  '01-button.png',
  '02-playground.png',
  '03-build-matrix.png',
];

for (const filename of screenshotNames) {
  const sourcePath = resolve(sourceRoot, filename);
  const outputPath = resolve(outputRoot, filename);
  const source = await readFile(sourcePath);
  const metadata = await sharp(source).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error(`Unable to read screenshot dimensions: ${filename}`);
  }
  if (metadata.width > target.width || metadata.height > target.height) {
    throw new Error(
      `${filename} is ${metadata.width}x${metadata.height}; ` +
        `the ${target.width}x${target.height} target would require scaling`,
    );
  }

  const left = Math.floor((target.width - metadata.width) / 2);
  const top = Math.floor((target.height - metadata.height) / 2);
  const sourcePixels = await sharp(source).ensureAlpha().raw().toBuffer();
  const framedPixels = Buffer.alloc(target.width * target.height * 4, 255);
  const sourceRowBytes = metadata.width * 4;
  for (let row = 0; row < metadata.height; row += 1) {
    const sourceOffset = row * sourceRowBytes;
    const framedOffset = ((top + row) * target.width + left) * 4;
    sourcePixels.copy(
      framedPixels,
      framedOffset,
      sourceOffset,
      sourceOffset + sourceRowBytes,
    );
  }

  const framed = await sharp(framedPixels, {
    raw: {width: target.width, height: target.height, channels: 4},
  })
    .png({compressionLevel: 9, adaptiveFiltering: true})
    .toBuffer();

  const embeddedPixels = await sharp(framed)
    .extract({
      left,
      top,
      width: metadata.width,
      height: metadata.height,
    })
    .ensureAlpha()
    .raw()
    .toBuffer();
  if (!embeddedPixels.equals(sourcePixels)) {
    throw new Error(`${filename} changed inside the framed screenshot`);
  }

  if (checkOnly) {
    const existing = await readFile(outputPath);
    if (!existing.equals(framed)) {
      throw new Error(
        `${filename} is stale; run pnpm brand:app-store:frame-screenshots`,
      );
    }
  } else {
    await mkdir(outputRoot, {recursive: true});
    await writeFile(outputPath, framed);
  }

  console.log(
    `${checkOnly ? 'checked' : 'generated'} ${filename} ` +
      `${target.width}x${target.height} source=${metadata.width}x${metadata.height} ` +
      `offset=${left},${top} ${framed.byteLength} bytes`,
  );
}
