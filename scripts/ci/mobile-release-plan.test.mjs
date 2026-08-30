import assert from 'node:assert/strict';
import test from 'node:test';

import {mobileReleasePlan, releaseTargets} from './mobile-release-plan.mjs';

test('all package target covers every release matrix cell', () => {
  const plan = mobileReleasePlan('all-packages');
  assert.equal(plan.include.length, 11);
  assert.equal(new Set(plan.include.map(cell => cell.id)).size, 11);
  assert.equal(plan.include.filter(cell => cell.platform === 'android').length, 6);
  assert.equal(plan.include.filter(cell => cell.platform === 'ios').length, 5);
});

test('only explicit upload targets upload to TestFlight', () => {
  for (const [target, cells] of Object.entries(releaseTargets)) {
    const uploadCells = cells.filter(cell => cell.testflight);
    assert.equal(uploadCells.length, ['ios-testflight', 'bootstrap-ci'].includes(target) ? 1 : 0);
  }
});

test('bootstrap verifies Android packaging and TestFlight together', () => {
  const plan = mobileReleasePlan('bootstrap-ci');
  assert.deepEqual(plan.include.map(cell => cell.platform).sort(), ['android', 'ios']);
});

test('release matrix keeps architecture boundaries intact', () => {
  for (const cell of mobileReleasePlan('all-packages').include) {
    if (cell.era === '0.66') assert.equal(cell.arch, 'old');
    if (cell.era === 'latest') assert.equal(cell.arch, 'new');
  }
});

test('unknown release targets fail closed', () => {
  assert.throws(() => mobileReleasePlan('unknown'), /Unknown mobile release target/);
});
