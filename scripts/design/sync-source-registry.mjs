import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import prettier from "prettier";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../..");
const registryRoot = path.join(repositoryRoot, "registry/native");
const manifestPath = path.join(registryRoot, "manifest.json");
const appNames = ["gongshu-0.66", "gongshu-0.77", "gongshu-latest"];
const checkOnly = process.argv.includes("--check");
const appArgumentIndex = process.argv.indexOf("--app");
const requestedApp =
  appArgumentIndex >= 0 ? process.argv[appArgumentIndex + 1] : null;

if (requestedApp && !appNames.includes(requestedApp)) {
  throw new Error(`Unknown Gongshu app: ${requestedApp}`);
}

const selectedApps = requestedApp ? [requestedApp] : appNames;
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const { appOutputs, packageOutputs } = validateManifest(manifest);
const staleTargets = [];

for (const output of packageOutputs) {
  await syncOutput(output, adaptSourceForPackage);
}

for (const appName of selectedApps) {
  for (const output of appOutputs) {
    await syncOutput(
      {
        ...output,
        target: path.posix.join("apps", appName, output.target),
        appName,
      },
      adaptSourceForApp
    );
  }
}

if (staleTargets.length > 0) {
  throw new Error(
    `Source registry outputs are stale:\n${staleTargets
      .map((value) => `- ${value}`)
      .join("\n")}\nRun pnpm registry:sync`
  );
}

console.log(
  checkOnly
    ? `Ruban source registry is current in ${selectedApps.join(", ")}`
    : `Synced Ruban source registry to ${selectedApps.join(", ")}`
);

function validateManifest(value) {
  if (value.schemaVersion !== 1 || typeof value.targetDirectory !== "string") {
    throw new Error(
      "Source registry manifest must use schemaVersion 1 and a targetDirectory"
    );
  }
  if (!Array.isArray(value.items) || value.items.length === 0) {
    throw new Error("Source registry manifest must contain items");
  }

  const seenNames = new Set();
  const seenFiles = new Set();
  const packageOutputs = [];
  const appOutputs = [];
  for (const item of value.items) {
    if (typeof item.name !== "string" || seenNames.has(item.name)) {
      throw new Error(`Invalid or duplicate registry item: ${item.name}`);
    }
    seenNames.add(item.name);
    if (
      typeof item.package !== "string" ||
      !/^react-native-ui-[a-z-]+$/.test(item.package)
    ) {
      throw new Error(`Registry item ${item.name} has an invalid package`);
    }
    if (!Array.isArray(item.files) || item.files.length === 0) {
      throw new Error(`Registry item ${item.name} has no files`);
    }
    for (const file of item.files) {
      if (
        typeof file !== "string" ||
        !/^[A-Za-z][A-Za-z0-9]*\.tsx?$/.test(file)
      ) {
        throw new Error(`Registry item ${item.name} has invalid file ${file}`);
      }
      if (seenFiles.has(file)) {
        throw new Error(`Registry file is assigned more than once: ${file}`);
      }
      seenFiles.add(file);
      packageOutputs.push({
        source: path.posix.join("ui", file),
        target: path.posix.join("packages", item.package, "src", file),
        package: item.package,
      });
    }
  }

  if (!Array.isArray(value.verificationFiles)) {
    throw new Error("Source registry manifest must contain verificationFiles");
  }
  for (const file of value.verificationFiles) {
    if (
      typeof file.source !== "string" ||
      !/^examples\/[A-Za-z][A-Za-z0-9]*\.tsx$/.test(file.source) ||
      typeof file.target !== "string" ||
      !/^src\/screens\/components\/[A-Za-z][A-Za-z0-9]*\.tsx$/.test(file.target)
    ) {
      throw new Error(
        "Source registry manifest contains an invalid verification file"
      );
    }
    if (appOutputs.some((output) => output.target === file.target)) {
      throw new Error(
        `Registry target is assigned more than once: ${file.target}`
      );
    }
    appOutputs.push(file);
  }

  if (!Array.isArray(value.testFiles)) {
    throw new Error("Source registry manifest must contain testFiles");
  }
  for (const file of value.testFiles) {
    if (
      typeof file.source !== "string" ||
      !/^tests\/[A-Za-z][A-Za-z0-9]*\.test\.js$/.test(file.source) ||
      typeof file.target !== "string" ||
      !/^__tests__\/[A-Za-z][A-Za-z0-9]*\.test\.js$/.test(file.target)
    ) {
      throw new Error("Source registry manifest contains an invalid test file");
    }
    if (appOutputs.some((output) => output.target === file.target)) {
      throw new Error(
        `Registry target is assigned more than once: ${file.target}`
      );
    }
    appOutputs.push(file);
  }

  return { appOutputs, packageOutputs };
}

async function syncOutput(output, adaptSource) {
  const sourcePath = path.join(registryRoot, output.source);
  const targetPath = path.join(repositoryRoot, output.target);
  const source = adaptSource(
    await readFile(sourcePath, "utf8"),
    output.appName || output.package
  );
  const prettierConfig = await prettier.resolveConfig(targetPath);
  const expected = prettier.format(source, {
    ...prettierConfig,
    filepath: targetPath,
  });
  const actual = await readFile(targetPath, "utf8").catch(() => "");

  if (checkOnly) {
    if (actual !== expected) {
      staleTargets.push(path.relative(repositoryRoot, targetPath));
    }
    return;
  }

  if (actual === expected) {
    return;
  }

  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, expected);
}

function adaptSourceForPackage(source, packageName) {
  let adapted = source.replaceAll(
    "../../design/tokens",
    "@ruban-labs/react-native-ui-theme"
  );

  if (
    packageName === "react-native-ui-dialog" ||
    packageName === "react-native-ui-sheet"
  ) {
    adapted = adapted.replaceAll(
      "./OverlayHost",
      "@ruban-labs/react-native-ui-overlay"
    );
  }

  return adapted;
}

function adaptSourceForApp(source, appName) {
  const packageImports = source
    .replaceAll(
      "../../components/ui/Dialog",
      "@ruban-labs/react-native-ui-dialog"
    )
    .replaceAll(
      "../../components/ui/OverlayHost",
      "@ruban-labs/react-native-ui-overlay"
    )
    .replaceAll(
      "../../components/ui/Checkbox",
      "@ruban-labs/react-native-ui-form/checkbox"
    )
    .replaceAll(
      "../../components/ui/Field",
      "@ruban-labs/react-native-ui-form/field"
    )
    .replaceAll(
      "../../components/ui/Input",
      "@ruban-labs/react-native-ui-form/input"
    )
    .replaceAll(
      "../../components/ui/RadioGroup",
      "@ruban-labs/react-native-ui-form/radio-group"
    )
    .replaceAll(
      "../../components/ui/Select",
      "@ruban-labs/react-native-ui-form/select"
    )
    .replaceAll(
      "../../components/ui/Textarea",
      "@ruban-labs/react-native-ui-form/textarea"
    )
    .replaceAll(
      "../../design/theme-colors",
      "@ruban-labs/react-native-ui-theme/colors"
    )
    .replaceAll(
      "../../design/tokens",
      "@ruban-labs/react-native-ui-theme"
    )
    .replaceAll(
      "../src/components/ui/OverlayCoordinator",
      "@ruban-labs/react-native-ui-overlay/coordinator"
    );

  if (appName === "gongshu-0.66") {
    return packageImports
      .replace(/\n\s*navigationBarTranslucent(?=\n)/g, "")
      .replaceAll("ruban-debug://", "ruban-rn066-debug://");
  }

  if (appName === "gongshu-0.77") {
    return packageImports.replaceAll(
      "ruban-debug://",
      "ruban-rn077-debug://"
    );
  }

  return packageImports;
}
