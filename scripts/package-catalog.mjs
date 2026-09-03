import path from 'node:path';

export const RUBAN_PACKAGE_DEFINITIONS = [
  ['@ruban-labs/react-native-progress', 'react-native-progress', 'ruban-progress-local.tgz'],
  ['@ruban-labs/react-native-collapsible', 'react-native-collapsible', 'ruban-collapsible-local.tgz'],
  ['@ruban-labs/react-native-ui-theme', 'react-native-ui-theme', 'ruban-ui-theme-local.tgz'],
  ['@ruban-labs/react-native-ui-overlay', 'react-native-ui-overlay', 'ruban-ui-overlay-local.tgz'],
  ['@ruban-labs/react-native-ui-dialog', 'react-native-ui-dialog', 'ruban-ui-dialog-local.tgz'],
  ['@ruban-labs/react-native-ui-sheet', 'react-native-ui-sheet', 'ruban-ui-sheet-local.tgz'],
  ['@ruban-labs/react-native-ui-form', 'react-native-ui-form', 'ruban-ui-form-local.tgz'],
];

export function resolveRubanPackages(repositoryRoot) {
  return RUBAN_PACKAGE_DEFINITIONS.map(([name, directory, tarball]) => ({
    name,
    directory: path.join(repositoryRoot, 'packages', directory),
    tarball,
  }));
}
