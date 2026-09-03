import path from "node:path";

export function resolveRustToolchain({
  repositoryRoot,
  environment = process.env,
}) {
  const targetDirectory = path.join(repositoryRoot, ".cache", "rust-target");
  const workspaceLocalRoot = environment.RAY_WORKSPACE_LOCAL_ROOT;

  if (!workspaceLocalRoot) {
    return {
      cargo: environment.CARGO || "cargo",
      rustup: environment.RUSTUP || "rustup",
      environment: {
        ...environment,
        CARGO_TARGET_DIR: environment.CARGO_TARGET_DIR || targetDirectory,
      },
    };
  }

  const cargoHome = path.join(
    workspaceLocalRoot,
    "toolchains",
    "rust",
    "cargo-home"
  );
  const rustupHome = path.join(
    workspaceLocalRoot,
    "toolchains",
    "rust",
    "rustup-home"
  );

  return {
    cargo: path.join(cargoHome, "bin", "cargo"),
    rustup: path.join(cargoHome, "bin", "rustup"),
    environment: {
      ...environment,
      CARGO_HOME: cargoHome,
      RUSTUP_HOME: rustupHome,
      RUSTUP_DIST_SERVER:
        environment.RUSTUP_DIST_SERVER || "https://rsproxy.cn",
      RUSTUP_UPDATE_ROOT:
        environment.RUSTUP_UPDATE_ROOT || "https://rsproxy.cn/rustup",
      CARGO_TARGET_DIR: environment.CARGO_TARGET_DIR || targetDirectory,
    },
  };
}
