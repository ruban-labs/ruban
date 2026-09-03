import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  ComponentShowcaseScreen,
  ShowcaseDataRow,
  ShowcaseDataTable,
  ShowcaseDeepLink,
  ShowcaseSection,
  ShowcaseSpecimen,
} from '../../components/showcase/ComponentShowcase';
import { Button } from '../../components/ui/Button';
import { Dialog } from '@ruban-labs/react-native-ui-dialog';
import { useOverlayBlocker } from '@ruban-labs/react-native-ui-overlay';
import { rubanColors, spacing } from '@ruban-labs/react-native-ui-theme';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ComponentDetail'> & {
  onBack: () => void;
};

type DialogScenario = 'standard' | 'sequential' | 'nested' | 'external';

function resolveScenario(value: string | undefined): DialogScenario {
  if (value === 'sequential' || value === 'nested' || value === 'external') {
    return value;
  }
  return 'standard';
}

export default function DialogShowcaseScreen({
  route,
  navigation,
  onBack,
}: Props): React.ReactElement {
  const scenario = resolveScenario(route.params.scenario);
  const [standardOpen, setStandardOpen] = React.useState(
    scenario === 'standard' && route.params.state === 'open',
  );
  const [firstOpen, setFirstOpen] = React.useState(scenario === 'sequential');
  const [secondOpen, setSecondOpen] = React.useState(false);
  const [parentOpen, setParentOpen] = React.useState(scenario === 'nested');
  const [childOpen, setChildOpen] = React.useState(false);
  const [externalGateActive, setExternalGateActive] = React.useState(
    scenario === 'external',
  );
  const [gatedOpen, setGatedOpen] = React.useState(scenario === 'external');
  const theme = route.params.theme === 'dark' ? 'dark' : 'light';
  const colors = rubanColors[theme];

  React.useEffect(() => {
    setStandardOpen(scenario === 'standard' && route.params.state === 'open');
    setFirstOpen(scenario === 'sequential');
    setSecondOpen(false);
    setParentOpen(scenario === 'nested');
    setChildOpen(false);
    setExternalGateActive(scenario === 'external');
    setGatedOpen(scenario === 'external');
  }, [route.params.state, scenario]);

  return (
    <ComponentShowcaseScreen
      index="12"
      name="Dialog"
      category="OVERLAY"
      distribution="SOURCE"
      status="READY"
      theme={theme}
      onThemeChange={nextTheme => navigation.setParams({ theme: nextTheme })}
      onBack={onBack}
    >
      {scenario === 'external' ? (
        <ShowcaseSection index="00" label="ACTIVE SCENARIO">
          <ShowcaseSpecimen label="EXTERNAL BLOCKER">
            <Button
              variant="destructive"
              onPress={() => setExternalGateActive(false)}
            >
              RELEASE GATE
            </Button>
          </ShowcaseSpecimen>
        </ShowcaseSection>
      ) : null}
      <ShowcaseSection index="01" label="STANDARD">
        <ShowcaseSpecimen label="CONTROLLED ROOT">
          <Dialog.Root
            id="dialog-showcase-standard"
            open={standardOpen}
            onOpenChange={setStandardOpen}
          >
            <Dialog.Trigger>
              <Button testID="dialog-open-standard">OPEN DIALOG</Button>
            </Dialog.Trigger>
            <Dialog.Content
              testID="dialog-standard"
              accessibilityLabel="Standard dialog"
            >
              <Dialog.Header>
                <Dialog.Title>PRECISION MODE</Dialog.Title>
              </Dialog.Header>
              <View style={[styles.valueBlock, { borderColor: colors.border }]}>
                <Text style={[styles.valueLabel, { color: colors.faint }]}>
                  TOLERANCE
                </Text>
                <Text style={[styles.value, { color: colors.ink }]}>
                  0.25 MM
                </Text>
              </View>
              <Dialog.Footer>
                <Dialog.Close>
                  <Button variant="outline" style={styles.footerButton}>
                    CANCEL
                  </Button>
                </Dialog.Close>
                <Button
                  style={styles.footerButton}
                  onPress={() => setStandardOpen(false)}
                >
                  APPLY
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Root>
        </ShowcaseSpecimen>
      </ShowcaseSection>

      <ShowcaseSection index="02" label="SEQUENTIAL">
        <ShowcaseSpecimen label="QUEUE POLICY">
          <Button onPress={() => setFirstOpen(true)}>START SEQUENCE</Button>
          <Dialog.Root
            id="dialog-showcase-first"
            open={firstOpen}
            strategy="queue"
            onOpenChange={setFirstOpen}
          >
            <Dialog.Content
              testID="dialog-sequence-first"
              accessibilityLabel="First dialog"
            >
              <Dialog.Header>
                <Dialog.Title>FIRST DIALOG</Dialog.Title>
              </Dialog.Header>
              <Dialog.Footer>
                <Button
                  onPress={() => {
                    setFirstOpen(false);
                    setSecondOpen(true);
                  }}
                >
                  NEXT DIALOG
                </Button>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Root>
          <Dialog.Root
            id="dialog-showcase-second"
            open={secondOpen}
            strategy="queue"
            onOpenChange={setSecondOpen}
          >
            <Dialog.Content
              testID="dialog-sequence-second"
              accessibilityLabel="Second dialog"
            >
              <Dialog.Header>
                <Dialog.Title>SECOND DIALOG</Dialog.Title>
              </Dialog.Header>
              <Dialog.Footer>
                <Dialog.Close>
                  <Button>DONE</Button>
                </Dialog.Close>
              </Dialog.Footer>
            </Dialog.Content>
          </Dialog.Root>
        </ShowcaseSpecimen>
      </ShowcaseSection>

      <ShowcaseSection index="03" label="NESTED">
        <ShowcaseSpecimen label="STACK POLICY">
          <Button onPress={() => setParentOpen(true)}>OPEN PARENT</Button>
          <Dialog.Root
            id="dialog-showcase-parent"
            open={parentOpen}
            strategy="queue"
            onOpenChange={setParentOpen}
          >
            <Dialog.Content
              testID="dialog-nested-parent"
              accessibilityLabel="Parent dialog"
            >
              <Dialog.Header>
                <Dialog.Title>PARENT DIALOG</Dialog.Title>
              </Dialog.Header>
              <Dialog.Footer>
                <Dialog.Close>
                  <Button variant="outline" style={styles.footerButton}>
                    CLOSE
                  </Button>
                </Dialog.Close>
                <Button
                  style={styles.footerButton}
                  onPress={() => setChildOpen(true)}
                >
                  OPEN CONFIRMATION
                </Button>
              </Dialog.Footer>
              <Dialog.Root
                id="dialog-showcase-child"
                open={childOpen}
                strategy="stack"
                onOpenChange={setChildOpen}
              >
                <Dialog.Content
                  testID="dialog-nested-child"
                  accessibilityLabel="Confirmation dialog"
                  role="alert"
                >
                  <Dialog.Header>
                    <Dialog.Title>CONFIRM ACTION</Dialog.Title>
                  </Dialog.Header>
                  <Dialog.Footer>
                    <Dialog.Close>
                      <Button>RETURN TO PARENT</Button>
                    </Dialog.Close>
                  </Dialog.Footer>
                </Dialog.Content>
              </Dialog.Root>
            </Dialog.Content>
          </Dialog.Root>
        </ShowcaseSpecimen>
      </ShowcaseSection>

      <ShowcaseSection index="04" label="EXTERNAL GATE">
        <ShowcaseSpecimen label="REFERENCE COUNTED BLOCKER">
          <ExternalGateSpecimen
            active={externalGateActive}
            dialogOpen={gatedOpen}
            onActiveChange={setExternalGateActive}
            onDialogOpenChange={setGatedOpen}
          />
        </ShowcaseSpecimen>
      </ShowcaseSection>

      <ShowcaseSection index="05" label="HOST CONTRACT">
        <ShowcaseDataTable>
          <ShowcaseDataRow label="Native modal hosts" value="01" />
          <ShowcaseDataRow label="Policies" value="STACK / REPLACE / QUEUE" />
          <ShowcaseDataRow label="External gates" value="REFERENCE COUNTED" />
        </ShowcaseDataTable>
        <ShowcaseDeepLink>
          ruban-debug://components/dialog?theme=light&amp;scenario=sequential
        </ShowcaseDeepLink>
      </ShowcaseSection>
    </ComponentShowcaseScreen>
  );
}

function ExternalGateSpecimen({
  active,
  dialogOpen,
  onActiveChange,
  onDialogOpenChange,
}: {
  active: boolean;
  dialogOpen: boolean;
  onActiveChange: (active: boolean) => void;
  onDialogOpenChange: (open: boolean) => void;
}): React.ReactElement {
  const [gateRegistered, setGateRegistered] = React.useState(false);
  useOverlayBlocker('dialog-showcase-external-gate', active);

  React.useEffect(() => {
    setGateRegistered(true);
  }, []);

  return (
    <View>
      <View style={styles.gateActions}>
        <Button
          variant={active ? 'destructive' : 'outline'}
          style={styles.footerButton}
          onPress={() => onActiveChange(!active)}
        >
          {active ? 'RELEASE GATE' : 'ENGAGE GATE'}
        </Button>
        <Button
          style={styles.footerButton}
          onPress={() => onDialogOpenChange(true)}
        >
          REQUEST DIALOG
        </Button>
      </View>
      {gateRegistered ? (
        <Dialog.Root
          id="dialog-showcase-gated"
          open={dialogOpen}
          strategy="queue"
          onOpenChange={onDialogOpenChange}
        >
          <Dialog.Content
            testID="dialog-external-gated"
            accessibilityLabel="Gated dialog"
          >
            <Dialog.Header>
              <Dialog.Title>GATED DIALOG</Dialog.Title>
            </Dialog.Header>
            <Dialog.Footer>
              <Dialog.Close>
                <Button>DONE</Button>
              </Dialog.Close>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Root>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  valueBlock: { padding: spacing.md, borderWidth: 1 },
  valueLabel: {
    fontSize: 8,
    lineHeight: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  value: {
    marginTop: 10,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  footerButton: { marginLeft: 8, marginBottom: 8 },
  gateActions: { flexDirection: 'row', flexWrap: 'wrap' },
});
