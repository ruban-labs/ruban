#!/usr/bin/env node

import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sourceRoot = resolve(
  repoRoot,
  'brand/store-assets/google-play/phone-screenshots-native',
);
const outputRoot = resolve(
  repoRoot,
  'brand/store-assets/google-play/phone-screenshots',
);
const checkOnly = process.argv.includes('--check');
const screenshotNames = [
  '01-home.png',
  '02-button.png',
  '03-playground.png',
  '04-build-matrix.png',
];

function frameSize(width, height) {
  const unit = Math.ceil(Math.max(width / 9, height / 16));
  return {width: unit * 9, height: unit * 16};
}

for (const filename of screenshotNames) {
  const sourcePath = resolve(sourceRoot, filename);
  const outputPath = resolve(outputRoot, filename);
  const source = await readFile(sourcePath);
  const metadata = await sharp(source).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error(`Unable to read screenshot dimensions: ${filename}`);
  }

  const canvas = frameSize(metadata.width, metadata.height);
  const left = Math.floor((canvas.width - metadata.width) / 2);
  const top = Math.floor((canvas.height - metadata.height) / 2);
  const sourcePixels = await sharp(source).ensureAlpha().raw().toBuffer();
  const framedPixels = Buffer.alloc(canvas.width * canvas.height * 4, 255);
  const sourceRowBytes = metadata.width * 4;
  for (let row = 0; row < metadata.height; row += 1) {
    const sourceOffset = row * sourceRowBytes;
    const framedOffset = ((top + row) * canvas.width + left) * 4;
    sourcePixels.copy(
      framedPixels,
      framedOffset,
      sourceOffset,
      sourceOffset + sourceRowBytes,
    );
  }
  const framed = await sharp(framedPixels, {
    raw: {width: canvas.width, height: canvas.height, channels: 4},
  })
    .png({compressionLevel: 9, adaptiveFiltering: true})
    .toBuffer();

  const embeddedPixels = await sharp(framed)
    .extract({left, top, width: metadata.width, height: metadata.height})
    .ensureAlpha()
    .raw()
    .toBuffer();
  if (!embeddedPixels.equals(sourcePixels)) {
    throw new Error(`${filename} changed inside the framed screenshot`);
  }
  if (framed.byteLength > 8_000_000) {
    throw new Error(`${filename} exceeds the Google Play 8 MB limit`);
  }

  if (checkOnly) {
    const existing = await readFile(outputPath);
    if (!existing.equals(framed)) {
      throw new Error(
        `${filename} is stale; run pnpm brand:google-play:frame-screenshots`,
      );
    }
  } else {
    await mkdir(outputRoot, {recursive: true});
    await writeFile(outputPath, framed);
  }

  console.log(
    `${checkOnly ? 'checked' : 'generated'} ${filename} ${canvas.width}x${canvas.height} ` +
      `source=${metadata.width}x${metadata.height} offset=${left},${top} ${framed.byteLength} bytes`,
  );
}
