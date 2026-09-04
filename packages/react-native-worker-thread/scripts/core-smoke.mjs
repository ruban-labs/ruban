import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

const packageRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const buildRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ruban-worker-runtime-'));
const output = path.join(buildRoot, 'worker-runtime-core-smoke');
const compiler = process.env.CXX || 'c++';

try {
  const result = spawnSync(
    compiler,
    [
      '-std=c++17',
      '-pthread',
      '-I',
      path.join(packageRoot, 'cpp', 'include'),
      path.join(packageRoot, 'cpp', 'WorkerRuntimeCore.cpp'),
      path.join(packageRoot, 'cpp', 'tests', 'WorkerRuntimeCoreTest.cpp'),
      '-o',
      output,
    ],
    {stdio: 'inherit'},
  );
  if (result.error || result.status !== 0) process.exit(result.status || 1);
  const smoke = spawnSync(output, [], {stdio: 'inherit'});
  if (smoke.error || smoke.status !== 0) process.exit(smoke.status || 1);
  console.log('worker-runtime-core: echo, bounds, exception, cancellation, timeout, 128 lifecycle waves, and termination smoke passed');
} finally {
  fs.rmSync(buildRoot, {recursive: true, force: true});
}
