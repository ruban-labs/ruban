const {
  getVisibleOverlayIds,
  OverlayCoordinator,
} = require('../src/components/ui/OverlayCoordinator');

function entry(id, strategy = 'queue') {
  return {id, strategy, value: id};
}

describe('OverlayCoordinator', () => {
  test('queues independent overlays and promotes without dismissing the host', () => {
    const coordinator = new OverlayCoordinator();

    coordinator.present(entry('first'));
    coordinator.hostDidShow();
    coordinator.present(entry('second'));

    expect(coordinator.getSnapshot()).toMatchObject({
      phase: 'active',
      active: [entry('first')],
      queued: [entry('second')],
    });

    coordinator.dismiss('first');

    expect(coordinator.getSnapshot()).toMatchObject({
      phase: 'active',
      active: [entry('second')],
      queued: [],
    });
  });

  test('keeps requests queued until native dismissal completes', () => {
    const coordinator = new OverlayCoordinator();

    coordinator.present(entry('first'));
    coordinator.hostDidShow();
    coordinator.dismiss('first');
    coordinator.present(entry('second', 'stack'));

    expect(coordinator.getSnapshot()).toMatchObject({
      phase: 'dismissing',
      active: [],
      queued: [entry('second', 'stack')],
    });

    coordinator.hostDidDismiss();

    expect(coordinator.getSnapshot()).toMatchObject({
      phase: 'presenting',
      active: [entry('second', 'stack')],
      queued: [],
    });
  });

  test('stacks logical overlays and restores replaced layers', () => {
    const coordinator = new OverlayCoordinator();

    coordinator.present(entry('base'));
    coordinator.present(entry('child', 'stack'));
    expect(getVisibleOverlayIds(coordinator.getSnapshot().active)).toEqual([
      'base',
      'child',
    ]);

    coordinator.present(entry('replacement', 'replace'));
    coordinator.present(entry('replacement-child', 'stack'));
    expect(getVisibleOverlayIds(coordinator.getSnapshot().active)).toEqual([
      'replacement',
      'replacement-child',
    ]);

    coordinator.dismiss('replacement-child');
    coordinator.dismiss('replacement');
    expect(getVisibleOverlayIds(coordinator.getSnapshot().active)).toEqual([
      'base',
      'child',
    ]);
  });

  test('reference-counts external blockers', () => {
    const coordinator = new OverlayCoordinator();

    coordinator.setBlocker('native-sheet', true);
    coordinator.setBlocker('native-sheet', true);
    coordinator.present(entry('dialog', 'stack'));
    coordinator.setBlocker('native-sheet', false);

    expect(coordinator.getSnapshot()).toMatchObject({
      phase: 'idle',
      active: [],
      queued: [entry('dialog', 'stack')],
      blockerIds: ['native-sheet'],
    });

    coordinator.setBlocker('native-sheet', false);

    expect(coordinator.getSnapshot()).toMatchObject({
      phase: 'presenting',
      active: [entry('dialog', 'stack')],
      queued: [],
      blockerIds: [],
    });
  });
});
