#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const registryRoot = path.join(repoRoot, "registry", "native", "ui");
const appRoot = path.join(repoRoot, "apps", "gongshu-latest", "src", "components", "ui");
const designRoot = path.join(repoRoot, "apps", "gongshu-latest", "src", "design");
const sourceExtensions = [".ts", ".tsx"];

function listSourceFiles(directory) {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && sourceExtensions.includes(path.extname(entry.name)))
    .map((entry) => path.join(directory, entry.name))
    .sort();
}

function moduleName(filePath) {
  return path.basename(filePath, path.extname(filePath));
}

function collectSources() {
  const registryFiles = listSourceFiles(registryRoot);
  const registryNames = new Set(registryFiles.map(moduleName));
  const appOnlyFiles = listSourceFiles(appRoot).filter(
    (filePath) => !registryNames.has(moduleName(filePath)),
  );

  return [
    ...listSourceFiles(designRoot).map((filePath) => ({
      id: `design/${moduleName(filePath)}`,
      filePath,
      origin: "design",
    })),
    ...registryFiles.map((filePath) => ({
      id: `ui/${moduleName(filePath)}`,
      filePath,
      origin: "registry",
    })),
    ...appOnlyFiles.map((filePath) => ({
      id: `ui/${moduleName(filePath)}`,
      filePath,
      origin: "app",
    })),
  ].sort((left, right) => left.id.localeCompare(right.id));
}

function parseImports(source) {
  const imports = [];
  const pattern = /\b(?:import|export)\s+(?:type\s+)?(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g;
  let match;

  while ((match = pattern.exec(source))) {
    imports.push(match[1]);
  }

  return imports;
}

function packageName(specifier) {
  const segments = specifier.split("/");
  return specifier.startsWith("@") ? segments.slice(0, 2).join("/") : segments[0];
}

function resolveInternalDependency(source, specifier, knownIds) {
  if (!specifier.startsWith(".")) {
    return null;
  }

  if (specifier.startsWith("../../design/")) {
    const candidate = `design/${path.basename(specifier)}`;
    return knownIds.has(candidate) ? candidate : null;
  }

  const namespace = source.id.startsWith("design/") ? "design" : "ui";
  const candidate = `${namespace}/${path.basename(specifier)}`;
  return knownIds.has(candidate) ? candidate : null;
}

function stronglyConnectedComponents(nodes, edges) {
  const adjacency = new Map(nodes.map((node) => [node, []]));
  edges.forEach(({ from, to }) => adjacency.get(from)?.push(to));
  let nextIndex = 0;
  const indexes = new Map();
  const lowLinks = new Map();
  const stack = [];
  const onStack = new Set();
  const components = [];

  function visit(node) {
    indexes.set(node, nextIndex);
    lowLinks.set(node, nextIndex);
    nextIndex += 1;
    stack.push(node);
    onStack.add(node);

    for (const dependency of adjacency.get(node) || []) {
      if (!indexes.has(dependency)) {
        visit(dependency);
        lowLinks.set(node, Math.min(lowLinks.get(node), lowLinks.get(dependency)));
      } else if (onStack.has(dependency)) {
        lowLinks.set(node, Math.min(lowLinks.get(node), indexes.get(dependency)));
      }
    }

    if (lowLinks.get(node) !== indexes.get(node)) {
      return;
    }

    const component = [];
    let member;
    do {
      member = stack.pop();
      onStack.delete(member);
      component.push(member);
    } while (member !== node);
    components.push(component.sort());
  }

  nodes.forEach((node) => {
    if (!indexes.has(node)) visit(node);
  });

  return components;
}

export function analyzeUiDependencies() {
  const sources = collectSources();
  const knownIds = new Set(sources.map((source) => source.id));
  const internalEdges = [];
  const externalEdges = [];

  for (const source of sources) {
    const imports = parseImports(fs.readFileSync(source.filePath, "utf8"));
    for (const specifier of imports) {
      const internalDependency = resolveInternalDependency(source, specifier, knownIds);
      if (internalDependency) {
        internalEdges.push({ from: source.id, to: internalDependency });
      } else if (!specifier.startsWith(".")) {
        externalEdges.push({ from: source.id, to: packageName(specifier) });
      }
    }
  }

  const uniqueEdges = (edges) =>
    [...new Map(edges.map((edge) => [`${edge.from}\0${edge.to}`, edge])).values()].sort(
      (left, right) => `${left.from}:${left.to}`.localeCompare(`${right.from}:${right.to}`),
    );
  const normalizedInternalEdges = uniqueEdges(internalEdges);
  const components = stronglyConnectedComponents(
    sources.map((source) => source.id),
    normalizedInternalEdges,
  );
  const cycles = components.filter(
    (component) =>
      component.length > 1 ||
      normalizedInternalEdges.some(
        (edge) => edge.from === component[0] && edge.to === component[0],
      ),
  );

  return {
    schemaVersion: 1,
    nodes: sources.map(({ id, origin }) => ({ id, origin })),
    internalEdges: normalizedInternalEdges,
    externalEdges: uniqueEdges(externalEdges),
    cycles,
  };
}

if (path.resolve(process.argv[1] || "") === fileURLToPath(import.meta.url)) {
  const report = analyzeUiDependencies();
  console.log(JSON.stringify(report, null, 2));

  if (process.argv.includes("--check") && report.cycles.length > 0) {
    process.exitCode = 1;
  }
}
