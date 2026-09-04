import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const packageRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'ruban-data-engine-'));
const binary = path.join(temporaryDirectory, 'ruban-data-engine-test');
const compiler = process.env.CXX || 'c++';

try {
  const compile = spawnSync(
    compiler,
    [
      '-std=c++17',
      '-Wall',
      '-Wextra',
      '-Werror',
      '-I',
      path.join(packageRoot, 'native', 'include'),
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
