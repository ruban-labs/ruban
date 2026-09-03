import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = path.resolve(packageRoot, '..', '..');
const workspaceLocalRoot = process.env.RAY_WORKSPACE_LOCAL_ROOT;

if (!workspaceLocalRoot) {
  throw new Error('RAY_WORKSPACE_LOCAL_ROOT is required to resolve the managed Rust toolchain');
}

const cargoHome = path.join(workspaceLocalRoot, 'toolchains', 'rust', 'cargo-home');
const rustupHome = path.join(workspaceLocalRoot, 'toolchains', 'rust', 'rustup-home');
const managedCargo = path.join(cargoHome, 'bin', 'cargo');
const repositoryTarget = path.join(repositoryRoot, '.cache', 'rust-target');
const args = process.argv.slice(2);

const result = spawnSync(managedCargo, args, {
  cwd: path.join(packageRoot, 'rust'),
  env: {
    ...process.env,
    CARGO_HOME: cargoHome,
    RUSTUP_HOME: rustupHome,
    CARGO_TARGET_DIR: repositoryTarget,
  },
  stdio: 'inherit',
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
