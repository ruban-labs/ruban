import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { resolveRustToolchain } from "./rust-environment.mjs";

test("uses the standard Rust commands outside RayAgents", () => {
  const toolchain = resolveRustToolchain({
    repositoryRoot: "/repo",
    environment: {},
  });

  assert.equal(toolchain.cargo, "cargo");
  assert.equal(toolchain.rustup, "rustup");
  assert.equal(
    toolchain.environment.CARGO_TARGET_DIR,
    "/repo/.cache/rust-target"
  );
  assert.equal(toolchain.environment.CARGO_HOME, undefined);
});

test("honors explicit standard commands and target directory", () => {
  const toolchain = resolveRustToolchain({
    repositoryRoot: "/repo",
    environment: {
      CARGO: "/toolchain/cargo",
      RUSTUP: "/toolchain/rustup",
      CARGO_TARGET_DIR: "/cache/target",
    },
  });

  assert.equal(toolchain.cargo, "/toolchain/cargo");
  assert.equal(toolchain.rustup, "/toolchain/rustup");
  assert.equal(toolchain.environment.CARGO_TARGET_DIR, "/cache/target");
});

test("prefers the workspace-managed Rust toolchain when available", () => {
  const workspaceLocalRoot = "/workspace/.workspace-local";
  const toolchain = resolveRustToolchain({
    repositoryRoot: "/repo",
    environment: { RAY_WORKSPACE_LOCAL_ROOT: workspaceLocalRoot },
  });
  const cargoHome = path.join(
    workspaceLocalRoot,
    "toolchains",
    "rust",
    "cargo-home"
  );

  assert.equal(toolchain.cargo, path.join(cargoHome, "bin", "cargo"));
  assert.equal(toolchain.rustup, path.join(cargoHome, "bin", "rustup"));
  assert.equal(toolchain.environment.CARGO_HOME, cargoHome);
  assert.equal(
    toolchain.environment.RUSTUP_HOME,
    path.join(workspaceLocalRoot, "toolchains", "rust", "rustup-home")
  );
});
