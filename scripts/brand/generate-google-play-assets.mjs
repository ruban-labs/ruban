#!/usr/bin/env node

import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const outputRoot = resolve(repoRoot, 'brand/store-assets/google-play');
const checkOnly = process.argv.includes('--check');

const config = JSON.parse(
  await readFile(resolve(repoRoot, 'brand/mobile-assets.json'), 'utf8'),
);
const production = config.channels.production;
const appIconSource = await readFile(
  resolve(repoRoot, 'brand/ruban-app-icon-dark.svg'),
  'utf8',
);
const coreSource = await readFile(
  resolve(repoRoot, 'brand/ruban-core.svg'),
  'utf8',
);
const lockupSource = await readFile(
  resolve(repoRoot, 'brand/ruban-lockup-horizontal.svg'),
  'utf8',
);

function replaceColor(svg, sourceColor, targetColor) {
  return svg.replaceAll(sourceColor.toLowerCase(), targetColor.toLowerCase());
}

function svgBody(svg) {
  const match = svg.match(/<svg[^>]*>([\s\S]*)<\/svg>/);
  if (!match) {
    throw new Error('Expected a complete SVG document');
  }
  return match[1].replace(/<title[\s\S]*?<\/title>/, '');
}

function productionAppIcon() {
  let svg = appIconSource.replace(
    /(<svg[^>]*>)/,
    `$1\n  <rect width="96" height="96" fill="${production.tile}"/>`,
  );
  svg = replaceColor(svg, '#101114', production.tile);
  svg = replaceColor(svg, '#ffffff', production.mark);
  return replaceColor(svg, '#4c8dff', production.accent);
}

function productionLockupBody() {
  return replaceColor(
    replaceColor(svgBody(lockupSource), '#d9ff45', production.mark),
    '#2563eb',
    production.accent,
  );
}

function productionCoreBody() {
  return replaceColor(
    replaceColor(svgBody(coreSource), '#d9ff45', production.mark),
    '#2563eb',
    production.accent,
  );
}

function featureGraphic() {
  const rulerTicks = Array.from({length: 19}, (_, index) => {
    const x = 80 + index * 48;
    const height = index % 4 === 0 ? 18 : index % 2 === 0 ? 12 : 7;
    return `<path d="M${x} 410v${height}"/>`;
  }).join('\n      ');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
  <rect width="1024" height="500" fill="${production.tile}"/>
  <rect x="34" y="34" width="956" height="432" fill="#15171c" stroke="#2b2f38" stroke-width="2"/>
  <path d="M34 116h956M34 384h956" stroke="#ffffff" stroke-opacity="0.07"/>
  <path d="M144 34v432M880 34v432" stroke="#ffffff" stroke-opacity="0.045"/>
  <svg x="666" y="24" width="430" height="430" viewBox="0 0 96 96" opacity="0.055">
    ${productionCoreBody()}
  </svg>
  <svg x="80" y="154" width="720" height="192" viewBox="0 0 360 96">
    ${productionLockupBody()}
  </svg>
  <rect x="80" y="376" width="288" height="8" fill="${production.accent}"/>
  <g fill="none" stroke="#ffffff" stroke-opacity="0.32" stroke-width="2">
    <path d="M80 410h864"/>
    ${rulerTicks}
  </g>
  <rect x="916" y="62" width="28" height="28" fill="${production.accent}"/>
</svg>`;
}

async function renderPng(svg, width, height) {
  return sharp(Buffer.from(svg))
    .resize(width, height, {fit: 'fill'})
    .png({compressionLevel: 9, adaptiveFiltering: true})
    .toBuffer();
}

const outputs = [
  {
    filename: 'app-icon-512.png',
    width: 512,
    height: 512,
    maxBytes: 1_000_000,
    buffer: await renderPng(productionAppIcon(), 512, 512),
  },
  {
    filename: 'feature-graphic-1024x500.png',
    width: 1024,
    height: 500,
    maxBytes: 15_000_000,
    buffer: await renderPng(featureGraphic(), 1024, 500),
  },
];

for (const output of outputs) {
  const metadata = await sharp(output.buffer).metadata();
  if (metadata.width !== output.width || metadata.height !== output.height) {
    throw new Error(
      `${output.filename} has ${metadata.width}x${metadata.height}, expected ${output.width}x${output.height}`,
    );
  }
  if (output.buffer.byteLength > output.maxBytes) {
    throw new Error(
      `${output.filename} is ${output.buffer.byteLength} bytes, limit is ${output.maxBytes}`,
    );
  }

  const outputPath = resolve(outputRoot, output.filename);
  if (checkOnly) {
    const existing = await readFile(outputPath);
    if (!existing.equals(output.buffer)) {
      throw new Error(`${output.filename} is stale; run pnpm brand:google-play:generate`);
    }
  } else {
    await mkdir(outputRoot, {recursive: true});
    await writeFile(outputPath, output.buffer);
  }

  console.log(
    `${checkOnly ? 'checked' : 'generated'} ${output.filename} ${output.width}x${output.height} ${output.buffer.byteLength} bytes`,
  );
}
