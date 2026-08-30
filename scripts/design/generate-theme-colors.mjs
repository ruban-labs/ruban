import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDir, '../..');
const sourcePath = path.join(repositoryRoot, 'design/theme-colors.json');
const checkOnly = process.argv.includes('--check');
const appTargets = [
  'apps/gongshu-0.66/src/design/theme-colors.ts',
  'apps/gongshu-0.76/src/design/theme-colors.ts',
  'apps/gongshu-latest/src/design/theme-colors.ts',
];
const cssTarget = 'website/src/assets/theme.generated.css';

const source = JSON.parse(await readFile(sourcePath, 'utf8'));
validateSource(source);

const outputs = new Map([
  ...appTargets.map(target => [target, renderTypeScript(source)]),
  [cssTarget, renderCss(source)],
]);

for (const [relativePath, expected] of outputs) {
  const target = path.join(repositoryRoot, relativePath);
  if (checkOnly) {
    const actual = await readFile(target, 'utf8').catch(() => '');
    if (actual !== expected) throw new Error(`${relativePath} is stale; run pnpm design:theme:generate`);
  } else {
    await writeFile(target, expected);
  }
}

console.log(checkOnly ? 'Ruban theme outputs are current' : 'Generated Ruban theme outputs');

function validateSource(value) {
  if (!Array.isArray(value.roles) || !Array.isArray(value.opacitySteps)) {
    throw new Error('Theme source requires roles and opacitySteps arrays');
  }
  const lightColors = value.themes?.light;
  const darkColors = value.themes?.dark;
  const lightSemantic = value.semantic?.light;
  const darkSemantic = value.semantic?.dark;
  for (const [name, colors] of Object.entries({lightColors, darkColors})) {
    if (!colors || typeof colors !== 'object') throw new Error(`Theme source requires ${name}`);
    for (const color of Object.values(colors)) {
      if (typeof color !== 'string' || !/^rgba\([\d., ]+\)$/.test(color)) {
        throw new Error(`${name} contains an invalid rgba color`);
      }
    }
  }
  assertSameKeys(lightColors, darkColors, 'theme colors');
  assertSameKeys(lightSemantic, darkSemantic, 'semantic colors');
  for (const role of value.roles) {
    for (const step of value.opacitySteps) {
      if (!lightColors[`${role}-${step}`]) throw new Error(`Missing color variant ${role}-${step}`);
    }
  }
  for (const [mode, semantic] of Object.entries(value.semantic)) {
    for (const [name, colorKey] of Object.entries(semantic)) {
      if (!value.themes[mode][colorKey]) throw new Error(`${mode}.${name} references missing color ${colorKey}`);
    }
  }
}

function assertSameKeys(left, right, label) {
  const leftKeys = Object.keys(left ?? {}).sort().join('\n');
  const rightKeys = Object.keys(right ?? {}).sort().join('\n');
  if (leftKeys !== rightKeys) throw new Error(`Light and dark ${label} must expose identical keys`);
}

function renderTypeScript(value) {
  const lightColors = renderValueObject(value.themes.light);
  const darkColors = renderValueObject(value.themes.dark);
  const lightSemantic = renderReferenceObject(value.semantic.light, 'lightThemeColors');
  const darkSemantic = renderReferenceObject(value.semantic.dark, 'darkThemeColors');
  return `export const rubanColorRoles = [${value.roles.map(quote).join(', ')}] as const;
export const rubanOpacitySteps = [${value.opacitySteps.join(', ')}] as const;

export type RubanColorRole = (typeof rubanColorRoles)[number];
export type RubanOpacityStep = (typeof rubanOpacitySteps)[number];
export type RubanGradientColorKey = \`${'${RubanColorRole}'}-${'${RubanOpacityStep}'}\`;

const lightThemeColors = ${lightColors} as const;

const darkThemeColors = ${darkColors} as const satisfies Record<keyof typeof lightThemeColors, string>;

export const rubanThemeColors = {
  light: lightThemeColors,
  dark: darkThemeColors,
} as const;

export type RubanThemeMode = keyof typeof rubanThemeColors;
export type RubanThemeColorVariantKey = keyof typeof lightThemeColors;
export type RubanThemeColorVariants = Record<RubanThemeColorVariantKey, string>;

const lightSemanticColors = ${lightSemantic} as const;

const darkSemanticColors = ${darkSemantic} as const satisfies Record<keyof typeof lightSemanticColors, string>;

export const rubanSemanticColors = {
  light: lightSemanticColors,
  dark: darkSemanticColors,
} as const;

export type RubanSemanticColorKey = keyof typeof lightSemanticColors;
export type RubanSemanticColors = Record<RubanSemanticColorKey, string>;
`;
}

function renderValueObject(values) {
  return `{
${Object.entries(values).map(([key, value]) => `  ${quote(key)}: ${quote(value)},`).join('\n')}
}`;
}

function renderReferenceObject(values, sourceName) {
  return `{
${Object.entries(values).map(([key, value]) => `  ${quote(key)}: ${sourceName}[${quote(value)}],`).join('\n')}
}`;
}

function renderCss(value) {
  const light = renderCssTheme(value, 'light');
  const dark = renderCssTheme(value, 'dark');
  return `:root,
[data-ruban-theme='light'] {
${light}
}

[data-ruban-theme='dark'] {
${dark}
}

@media (prefers-color-scheme: dark) {
  :root:not([data-ruban-theme='light']) {
${indent(dark, 2)}
  }
}
`;
}

function renderCssTheme(value, mode) {
  const primitive = Object.entries(value.themes[mode]).map(
    ([key, color]) => `  --ruban-color-${key}: ${color};`,
  );
  const semantic = Object.entries(value.semantic[mode]).map(
    ([key, colorKey]) => `  --ruban-${key}: var(--ruban-color-${colorKey});`,
  );
  return [...primitive, ...semantic].join('\n');
}

function indent(value, count) {
  const prefix = ' '.repeat(count);
  return value.split('\n').map(line => `${prefix}${line}`).join('\n');
}

function quote(value) {
  return `'${String(value).replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`;
}
