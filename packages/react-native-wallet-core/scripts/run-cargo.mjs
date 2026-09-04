import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { resolveRustToolchain } from "./rust-environment.mjs";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const repositoryRoot = path.resolve(packageRoot, "..", "..");
const toolchain = resolveRustToolchain({ repositoryRoot });
const args = process.argv.slice(2);

const result = spawnSync(toolchain.cargo, args, {
  cwd: path.join(packageRoot, "rust"),
  env: toolchain.environment,
  stdio: "inherit",
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
