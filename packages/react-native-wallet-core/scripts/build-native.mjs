import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const repositoryRoot = path.resolve(packageRoot, "..", "..");
const workspaceLocalRoot = process.env.RAY_WORKSPACE_LOCAL_ROOT;

if (!workspaceLocalRoot) {
  throw new Error(
    "RAY_WORKSPACE_LOCAL_ROOT is required to resolve the managed Rust toolchain"
  );
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
const cargo = path.join(cargoHome, "bin", "cargo");
const rustup = path.join(cargoHome, "bin", "rustup");
const targetDirectory = path.join(repositoryRoot, ".cache", "rust-target");
const rustRoot = path.join(packageRoot, "rust");
const requested =
  readArgument("--platform") ||
  (process.platform === "darwin" ? "all" : "android");
const platforms = requested === "all" ? ["android", "ios"] : [requested];

if (platforms.some((platform) => !["android", "ios"].includes(platform))) {
  throw new Error("Expected --platform android, ios, or all");
}
if (platforms.includes("ios") && process.platform !== "darwin") {
  throw new Error("iOS native artifacts require macOS");
}

for (const platform of platforms) {
  if (platform === "android") buildAndroid();
  else buildIos();
}

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || rustRoot,
    env: options.env || process.env,
    encoding: options.capture ? "utf8" : undefined,
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (options.capture)
      process.stderr.write(`${result.stdout || ""}${result.stderr || ""}`);
    throw new Error(
      `${command} ${args.join(" ")} exited with ${result.status}`
    );
  }
  return options.capture
    ? `${result.stdout || ""}${result.stderr || ""}`.trim()
    : "";
}

function managedEnvironment(extra = {}) {
  return {
    ...process.env,
    CARGO_HOME: cargoHome,
    RUSTUP_HOME: rustupHome,
    RUSTUP_DIST_SERVER: process.env.RUSTUP_DIST_SERVER || "https://rsproxy.cn",
    RUSTUP_UPDATE_ROOT:
      process.env.RUSTUP_UPDATE_ROOT || "https://rsproxy.cn/rustup",
    CARGO_TARGET_DIR: targetDirectory,
    ...extra,
  };
}

function ensureTargets(targets) {
  const installed = new Set(
    run(rustup, ["target", "list", "--installed"], {
      capture: true,
      env: managedEnvironment(),
    }).split(/\s+/)
  );
  const missing = targets.filter((target) => !installed.has(target));
  if (missing.length > 0)
    run(rustup, ["target", "add", ...missing], { env: managedEnvironment() });
}

function sourceFingerprint(platform, extra) {
  const hash = crypto.createHash("sha256");
  hash.update(`ruban-wallet-core-native-v1\0${platform}\0${extra}\0`);
  for (const file of recursiveFiles(rustRoot).sort()) {
    hash.update(path.relative(packageRoot, file));
    hash.update("\0");
    hash.update(fs.readFileSync(file));
    hash.update("\0");
  }
  hash.update(fs.readFileSync(fileURLToPath(import.meta.url)));
  return hash.digest("hex");
}

function recursiveFiles(directory) {
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "target") continue;
    const current = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...recursiveFiles(current));
    else if (entry.isFile()) result.push(current);
  }
  return result;
}

function isCurrent(platform, fingerprint, outputs) {
  const manifestPath = path.join(packageRoot, `.native-build.${platform}.json`);
  if (!outputs.every((output) => fs.existsSync(output))) return false;
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    return (
      manifest.fingerprint === fingerprint &&
      manifest.outputs.length === outputs.length
    );
  } catch {
    return false;
  }
}

function recordBuild(platform, fingerprint, outputs) {
  fs.writeFileSync(
    path.join(packageRoot, `.native-build.${platform}.json`),
    `${JSON.stringify(
      {
        fingerprint,
        outputs: outputs.map((output) => path.relative(packageRoot, output)),
      },
      null,
      2
    )}\n`
  );
}

function resolveNdk() {
  const direct = process.env.ANDROID_NDK_HOME || process.env.ANDROID_NDK_ROOT;
  if (direct && fs.existsSync(direct)) return direct;
  const sdk =
    process.env.ANDROID_HOME ||
    process.env.ANDROID_SDK_ROOT ||
    path.join(os.homedir(), "Library", "Android", "sdk");
  const ndkRoot = path.join(sdk, "ndk");
  const versions = fs
    .readdirSync(ndkRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) =>
      left.localeCompare(right, undefined, { numeric: true })
    );
  if (versions.length === 0)
    throw new Error(`No Android NDK found under ${ndkRoot}`);
  return path.join(ndkRoot, versions[versions.length - 1]);
}

function buildAndroid() {
  const ndk = resolveNdk();
  const prebuiltRoot = path.join(ndk, "toolchains", "llvm", "prebuilt");
  const hostPrefix = process.platform === "darwin" ? "darwin-" : "linux-";
  const host = fs
    .readdirSync(prebuiltRoot)
    .find((name) => name.startsWith(hostPrefix));
  if (!host)
    throw new Error(
      `No ${hostPrefix} Android NDK toolchain found under ${prebuiltRoot}`
    );
  const toolchain = path.join(
    ndk,
    "toolchains",
    "llvm",
    "prebuilt",
    host,
    "bin"
  );
  const targets = [
    ["aarch64-linux-android", "arm64-v8a", "aarch64-linux-android21-clang"],
    [
      "armv7-linux-androideabi",
      "armeabi-v7a",
      "armv7a-linux-androideabi21-clang",
    ],
    ["i686-linux-android", "x86", "i686-linux-android21-clang"],
    ["x86_64-linux-android", "x86_64", "x86_64-linux-android21-clang"],
  ];
  const outputs = targets.map(([, abi]) =>
    path.join(
      packageRoot,
      "android",
      "src",
      "main",
      "jniLibs",
      abi,
      "libruban_wallet_core.so"
    )
  );
  const fingerprint = sourceFingerprint("android", path.basename(ndk));
  if (isCurrent("android", fingerprint, outputs)) {
    console.log("ruban-wallet-core: Android native cache hit");
    return;
  }
  ensureTargets(targets.map(([target]) => target));
  for (const [target, abi, compiler] of targets) {
    const linker = path.join(toolchain, compiler);
    const key = target.toUpperCase().replaceAll("-", "_");
    run(cargo, ["build", "--release", "--locked", "--target", target], {
      env: managedEnvironment({
        [`CARGO_TARGET_${key}_LINKER`]: linker,
        [`CC_${target.replaceAll("-", "_")}`]: linker,
        RUSTFLAGS: "-C link-arg=-Wl,-z,max-page-size=16384",
      }),
    });
    const destination = path.join(
      packageRoot,
      "android",
      "src",
      "main",
      "jniLibs",
      abi,
      "libruban_wallet_core.so"
    );
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(
      path.join(targetDirectory, target, "release", "libruban_wallet_core.so"),
      destination
    );
  }
  recordBuild("android", fingerprint, outputs);
}

function buildIos() {
  const targets = [
    "aarch64-apple-ios",
    "aarch64-apple-ios-sim",
    "x86_64-apple-ios",
  ];
  const output = path.join(packageRoot, "ios", "RubanWalletCore.xcframework");
  const outputs = [path.join(output, "Info.plist")];
  const xcodeVersion = run("xcodebuild", ["-version"], { capture: true });
  const fingerprint = sourceFingerprint("ios", xcodeVersion);
  if (isCurrent("ios", fingerprint, outputs)) {
    console.log("ruban-wallet-core: iOS native cache hit");
    return;
  }
  ensureTargets(targets);
  for (const target of targets) {
    run(cargo, ["build", "--release", "--locked", "--target", target], {
      env: managedEnvironment({ IPHONEOS_DEPLOYMENT_TARGET: "12.4" }),
    });
  }
  const staging = path.join(repositoryRoot, ".cache", "rust-native", "ios");
  fs.mkdirSync(staging, { recursive: true });
  const simulatorDirectory = path.join(staging, "simulator");
  fs.mkdirSync(simulatorDirectory, { recursive: true });
  const simulatorLibrary = path.join(
    simulatorDirectory,
    "libruban_wallet_core.a"
  );
  run("xcrun", [
    "lipo",
    "-create",
    path.join(
      targetDirectory,
      "aarch64-apple-ios-sim",
      "release",
      "libruban_wallet_core.a"
    ),
    path.join(
      targetDirectory,
      "x86_64-apple-ios",
      "release",
      "libruban_wallet_core.a"
    ),
    "-output",
    simulatorLibrary,
  ]);
  fs.rmSync(output, { recursive: true, force: true });
  run("xcodebuild", [
    "-create-xcframework",
    "-library",
    path.join(
      targetDirectory,
      "aarch64-apple-ios",
      "release",
      "libruban_wallet_core.a"
    ),
    "-headers",
    path.join(rustRoot, "include"),
    "-library",
    simulatorLibrary,
    "-headers",
    path.join(rustRoot, "include"),
    "-output",
    output,
  ]);
  recordBuild("ios", fingerprint, outputs);
}
