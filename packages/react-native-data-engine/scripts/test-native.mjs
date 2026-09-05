import {spawnSync} from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';

const packageRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'ruban-data-engine-'));
const binary = path.join(temporaryDirectory, 'ruban-data-engine-test');
const compiler = process.env.CXX || 'c++';
const doctestVersion = 'v2.5.3';
const doctestSha256 =
  'cfd518a3ef90f67e1f3ba514df23fb3627437de1a2feeba78cf5062a40021421';
const dependencyDirectory = path.join(os.tmpdir(), 'ruban-native-test-deps');
const doctestHeader = path.join(
  dependencyDirectory,
  `doctest-${doctestVersion}.h`,
);

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function download(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, response => {
        if (
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          response.resume();
          download(new URL(response.headers.location, url)).then(resolve, reject);
          return;
        }
        if (response.statusCode !== 200) {
          response.resume();
          reject(new Error(`doctest download failed: ${response.statusCode}`));
          return;
        }
        const chunks = [];
        let size = 0;
        response.on('data', chunk => {
          size += chunk.length;
          if (size > 1024 * 1024) {
            response.destroy(new Error('doctest header exceeded size limit'));
            return;
          }
          chunks.push(chunk);
        });
        response.on('end', () => resolve(Buffer.concat(chunks)));
        response.on('error', reject);
      })
      .on('error', reject)
      .setTimeout(30000, function onTimeout() {
        this.destroy(new Error('doctest download timed out'));
      });
  });
}

async function ensureDoctest() {
  if (fs.existsSync(doctestHeader)) {
    const current = fs.readFileSync(doctestHeader);
    if (sha256(current) === doctestSha256) return;
  }
  const downloaded = await download(
    `https://raw.githubusercontent.com/doctest/doctest/${doctestVersion}/doctest/doctest.h`,
  );
  if (sha256(downloaded) !== doctestSha256) {
    throw new Error('doctest header checksum mismatch');
  }
  fs.mkdirSync(dependencyDirectory, {recursive: true});
  fs.writeFileSync(doctestHeader, downloaded, {mode: 0o600});
}

try {
  await ensureDoctest();
  const compile = spawnSync(
    compiler,
    [
      '-std=c++17',
      '-Wall',
      '-Wextra',
      '-Werror',
      '-I',
      path.join(packageRoot, 'native', 'include'),
      '-I',
      dependencyDirectory,
      path.join(packageRoot, 'native', 'src', 'ruban_json.cpp'),
      path.join(packageRoot, 'native', 'src', 'debank_provider.cpp'),
      path.join(packageRoot, 'native', 'src', 'ruban_data_engine.cpp'),
      path.join(packageRoot, 'native', 'tests', 'ruban_data_engine_test.cpp'),
      '-o',
      binary,
    ],
    {stdio: 'inherit'},
  );
  if (compile.status !== 0) process.exit(compile.status ?? 1);
  const test = spawnSync(binary, [], {stdio: 'inherit'});
  process.exitCode = test.status ?? 1;
} finally {
  fs.rmSync(temporaryDirectory, {recursive: true, force: true});
}
