import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createIosNativeFingerprint,
  isIosNativeInput,
} from './ios-native-fingerprint.mjs';

test('selects app and package native inputs', () => {
  assert.equal(
    isIosNativeInput('apps/gongshu-latest/ios/AppDelegate.swift', 'gongshu-latest'),
    true,
  );
  assert.equal(
    isIosNativeInput('apps/gongshu-latest/src/App.tsx', 'gongshu-latest'),
    false,
  );
  assert.equal(
    isIosNativeInput('apps/gongshu-0.77/ios/Podfile', 'gongshu-latest'),
    false,
  );
  assert.equal(
    isIosNativeInput('packages/react-native-wallet-core/rust/src/lib.rs', 'gongshu-latest'),
    true,
  );
  assert.equal(
    isIosNativeInput('packages/ui-button/src/Button.tsx', 'gongshu-latest'),
    false,
  );
});

test('ignores JS-only changes but invalidates native changes', () => {
  const files = [
    'apps/gongshu-latest/ios/Podfile',
    'apps/gongshu-latest/src/App.tsx',
    'packages/react-native-wallet-core/cpp/wallet.cpp',
  ];
  const contents = new Map([
    ['apps/gongshu-latest/ios/Podfile', Buffer.from('pod')],
    ['apps/gongshu-latest/src/App.tsx', Buffer.from('first')],
    ['packages/react-native-wallet-core/cpp/wallet.cpp', Buffer.from('native')],
  ]);
  const readFile = file => contents.get(file);
  const first = createIosNativeFingerprint(files, 'gongshu-latest', readFile);
  contents.set('apps/gongshu-latest/src/App.tsx', Buffer.from('second'));
  assert.equal(
    createIosNativeFingerprint(files, 'gongshu-latest', readFile),
    first,
  );
  contents.set(
    'packages/react-native-wallet-core/cpp/wallet.cpp',
    Buffer.from('changed'),
  );
  assert.notEqual(
    createIosNativeFingerprint(files, 'gongshu-latest', readFile),
    first,
  );
});
