import {
  getVisibleOverlayIds,
  OverlayCoordinator,
  type OverlayEntry,
  type OverlayStrategy,
} from '../OverlayCoordinator';

function entry(
  id: string,
  strategy: OverlayStrategy = 'queue',
): OverlayEntry<string> {
  return {id, strategy, value: id};
}

describe('OverlayCoordinator', () => {
  it('queues and promotes overlays without dismissing the host', () => {
    const coordinator = new OverlayCoordinator<string>();

    coordinator.present(entry('first'));
    coordinator.hostDidShow();
    coordinator.present(entry('second'));
    coordinator.dismiss('first');

    expect(coordinator.getSnapshot()).toMatchObject({
      phase: 'active',
      active: [entry('second')],
      queued: [],
    });
  });

  it('stacks logical layers and restores replaced layers', () => {
    const coordinator = new OverlayCoordinator<string>();

    coordinator.present(entry('base'));
    coordinator.present(entry('child', 'stack'));
    coordinator.present(entry('replacement', 'replace'));
    coordinator.dismiss('replacement');

    expect(getVisibleOverlayIds(coordinator.getSnapshot().active)).toEqual([
      'base',
      'child',
    ]);
  });

  it('waits for external blockers', () => {
    const coordinator = new OverlayCoordinator<string>();

    coordinator.setBlocker('native-sheet', true);
    coordinator.present(entry('dialog', 'stack'));
    expect(coordinator.getSnapshot().queued).toEqual([entry('dialog', 'stack')]);

    coordinator.setBlocker('native-sheet', false);
    expect(coordinator.getSnapshot().active).toEqual([entry('dialog', 'stack')]);
  });
});
