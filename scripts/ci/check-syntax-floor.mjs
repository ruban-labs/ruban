#!/usr/bin/env node
// Syntax floor check (CI matrix layer 1).
//
// Parses every published compiled JS file with an ES2019 grammar. Old
// Metro/JSC setups (the RN 0.66 era) do not transform node_modules, so any
// ES2020+ syntax in lib output would crash real apps at parse time.

import { Parser } from 'acorn';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
const libDir = path.join(repoRoot, 'packages', 'react-native-progress', 'lib');

function collectJs(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectJs(full));
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

if (!fs.existsSync(libDir)) {
  console.error('lib/ not found - run `pnpm build` first.');
  process.exit(1);
}

const files = collectJs(libDir);
let failures = 0;
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  const sourceTypes = file.includes(`${path.sep}module${path.sep}`)
    ? ['module']
    : ['script', 'module'];
  let parsed = false;
  let lastError;
  for (const sourceType of sourceTypes) {
    try {
      Parser.parse(source, { ecmaVersion: 2019, sourceType });
      parsed = true;
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!parsed) {
    const error = lastError;
    failures += 1;
    console.error(`SYNTAX FLOOR FAIL: ${path.relative(repoRoot, file)}: ${error.message}`);
  }
}

if (failures > 0) {
  console.error(`${failures}/${files.length} files use post-ES2019 syntax.`);
  process.exit(1);
}
console.log(`Syntax floor OK: ${files.length} files parse as ES2019.`);
