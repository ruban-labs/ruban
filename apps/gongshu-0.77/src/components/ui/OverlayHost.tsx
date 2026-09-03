import * as React from 'react';
import {Modal, Platform, StyleSheet, View} from 'react-native';
import {
  getVisibleOverlayIds,
  OverlayCoordinator,
  type OverlaySnapshot,
  type OverlayStrategy,
} from './OverlayCoordinator';

type OverlayLayer = {
  content: React.ReactElement;
  onRequestClose: () => void;
};

type OverlayContextValue = {
  coordinator: OverlayCoordinator<OverlayLayer>;
};

type OverlayLayerRegistration = {
  id: string;
  visible: boolean;
  strategy?: OverlayStrategy;
  content: React.ReactElement;
  onRequestClose: () => void;
};

const OverlayContext = React.createContext<OverlayContextValue | null>(null);

let overlayIdSequence = 0;

export function useStableOverlayId(prefix: string): string {
  const idRef = React.useRef<string | null>(null);
  if (!idRef.current) {
    overlayIdSequence += 1;
    idRef.current = `${prefix}-${overlayIdSequence}`;
  }
  return idRef.current;
}

export function OverlayProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const coordinatorRef = React.useRef<OverlayCoordinator<OverlayLayer> | null>(
    null,
  );
  if (!coordinatorRef.current) {
    coordinatorRef.current = new OverlayCoordinator<OverlayLayer>();
  }

  const coordinator = coordinatorRef.current;
  const contextValue = React.useMemo(() => ({coordinator}), [coordinator]);

  return (
    <OverlayContext.Provider value={contextValue}>
      {children}
      <NativeOverlayHost coordinator={coordinator} />
    </OverlayContext.Provider>
  );
}

export function useOverlayLayer({
  id,
  visible,
  strategy = 'queue',
  content,
  onRequestClose,
}: OverlayLayerRegistration): void {
  const {coordinator} = useOverlayContext();
  const entry = React.useMemo(
    () => ({
      id,
      strategy,
      value: {content, onRequestClose},
    }),
    [content, id, onRequestClose, strategy],
  );
  const entryRef = React.useRef(entry);
  entryRef.current = entry;

  React.useEffect(() => {
    if (!visible) {
      return;
    }

    coordinator.present(entryRef.current);
    return () => coordinator.dismiss(id);
  }, [coordinator, id, visible]);

  React.useEffect(() => {
    if (visible) {
      coordinator.present(entry);
    }
  }, [coordinator, entry, visible]);
}

export function useOverlayBlocker(id: string, blocked: boolean): void {
  const {coordinator} = useOverlayContext();

  React.useEffect(() => {
    if (!blocked) {
      return;
    }

    coordinator.setBlocker(id, true);
    return () => coordinator.setBlocker(id, false);
  }, [blocked, coordinator, id]);
}

function useOverlayContext(): OverlayContextValue {
  const context = React.useContext(OverlayContext);
  if (!context) {
    throw new Error('Ruban overlays must be rendered inside OverlayProvider.');
  }
  return context;
}

function NativeOverlayHost({
  coordinator,
}: {
  coordinator: OverlayCoordinator<OverlayLayer>;
}): React.ReactElement {
  const [snapshot, setSnapshot] = React.useState<OverlaySnapshot<OverlayLayer>>(
    coordinator.getSnapshot(),
  );

  React.useEffect(() => coordinator.subscribe(setSnapshot), [coordinator]);

  React.useEffect(() => {
    if (Platform.OS !== 'ios' && snapshot.phase === 'dismissing') {
      coordinator.hostDidDismiss();
    }
  }, [coordinator, snapshot.phase]);

  const visibleIds = getVisibleOverlayIds(snapshot.active);
  const visibleIdSet = new Set(visibleIds);
  const topId = visibleIds[visibleIds.length - 1];
  const nativeVisible =
    snapshot.phase === 'presenting' || snapshot.phase === 'active';
  const topEntry = snapshot.active.find(entry => entry.id === topId);

  return (
    <Modal
      visible={nativeVisible}
      transparent
      hardwareAccelerated
      statusBarTranslucent
      navigationBarTranslucent
      animationType="none"
      onShow={() => coordinator.hostDidShow()}
      onDismiss={() => coordinator.hostDidDismiss()}
      onRequestClose={() => topEntry?.value.onRequestClose()}>
      <View style={styles.host} testID="ruban-overlay-host">
        {snapshot.active.map(entry => {
          const layerVisible = visibleIdSet.has(entry.id);
          const topLayer = entry.id === topId;

          return (
            <View
              key={entry.id}
              testID={`ruban-overlay-layer-${entry.id}`}
              pointerEvents={topLayer ? 'auto' : 'none'}
              accessibilityElementsHidden={!topLayer}
              importantForAccessibility={
                topLayer ? 'yes' : 'no-hide-descendants'
              }
              style={[styles.layer, !layerVisible ? styles.hidden : undefined]}>
              {entry.value.content}
            </View>
          );
        })}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  host: {flex: 1},
  layer: {position: 'absolute', top: 0, right: 0, bottom: 0, left: 0},
  hidden: {display: 'none'},
});

export type {OverlayStrategy};
