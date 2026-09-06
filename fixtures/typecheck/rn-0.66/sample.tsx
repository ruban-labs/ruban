import * as React from "react";
import Collapsible, { Accordion } from "@ruban-labs/react-native-collapsible";
import AccordionDeep from "@ruban-labs/react-native-collapsible/Accordion";
import {
  createProviderContentScript,
  DappBridgeHostSession,
} from "@ruban-labs/react-native-dapp-bridge";
import { createEvmClient } from "@ruban-labs/react-native-evm-client";
import { WorkerThread } from "@ruban-labs/react-native-worker-thread";
import {
  Bar,
  Circle,
  CircleSnail,
  Pie,
  DEFAULT_COLOR,
} from "@ruban-labs/react-native-progress";
import { Dialog } from "@ruban-labs/react-native-ui-dialog";
import { Checkbox } from "@ruban-labs/react-native-ui-form/checkbox";
import { Field, FieldLabel } from "@ruban-labs/react-native-ui-form/field";
import { Input } from "@ruban-labs/react-native-ui-form/input";
import {
  RadioGroup,
  RadioGroupItem,
} from "@ruban-labs/react-native-ui-form/radio-group";
import { Select } from "@ruban-labs/react-native-ui-form/select";
import { Textarea } from "@ruban-labs/react-native-ui-form/textarea";
import { OverlayProvider } from "@ruban-labs/react-native-ui-overlay";
import { BottomSheetModal } from "@ruban-labs/react-native-ui-sheet";
import { RubanThemeProvider } from "@ruban-labs/react-native-ui-theme";
import { RefreshIcon } from "@ruban-labs/react-native-ui-icons";
import { isWalletCoreAvailable } from "@ruban-labs/react-native-wallet-core";

const bridgeSession = new DappBridgeHostSession("fixture-session");
const providerScript = createProviderContentScript({
  sessionId: bridgeSession.sessionId,
  providerInfo: {
    name: "Ruban Fixture",
    icon: "data:image/svg+xml;base64,PHN2Zy8+",
    rdns: "work.ruban-labs.fixture",
  },
});
const evmClient = createEvmClient({
  fetch: async () => ({ ok: true, status: 200, json: async () => ({}) }),
});
void providerScript;
void evmClient;
void isWalletCoreAvailable;

export function Sample(): React.ReactElement {
  const sections = ["FIRST", "SECOND"] as const;
  const worker = WorkerThread.create({
    name: "typecheck-066",
    bundle: {id: "com.ruban.fixture.066"},
    capabilities: ['log'],
    limits: {maxQueueDepth: 8, maxMessageBytes: 1024},
  });
  void worker.then(instance => instance.terminate());

  return (
    <>
      <RubanThemeProvider mode="light">
        <OverlayProvider>
          <RefreshIcon size={20} color="#ff5a36" />
          <Dialog.Root>
            <Dialog.Content>
              <FieldLabel>Dialog</FieldLabel>
            </Dialog.Content>
          </Dialog.Root>
          <BottomSheetModal
            visible={false}
            title="Sheet"
            onDismiss={() => undefined}
          >
            <FieldLabel>Sheet</FieldLabel>
          </BottomSheetModal>
          <Field>
            <FieldLabel required>Name</FieldLabel>
            <Input placeholder="Name" />
            <Textarea minRows={3} />
            <Checkbox checked={false} label="Remember" />
            <RadioGroup value="one">
              <RadioGroupItem label="One" value="one" />
            </RadioGroup>
            <Select options={[{ label: "One", value: "one" }]} value="one" />
          </Field>
        </OverlayProvider>
      </RubanThemeProvider>
      <Collapsible collapsed={false} duration={0} align="bottom">
        <Bar progress={0.2} />
      </Collapsible>
      <Accordion
        sections={sections}
        activeSections={[0]}
        onChange={() => undefined}
        renderHeader={(section) => <Bar>{section}</Bar>}
        renderContent={() => <Circle progress={0.4} />}
      />
      <AccordionDeep
        sections={[]}
        activeSections={[]}
        onChange={() => undefined}
        renderHeader={() => null}
        renderContent={() => null}
      />
      <Bar progress={0.5} width={200} color="#ff0000" animationType="timing" />
      <Bar indeterminate useNativeDriver />
      <Circle
        progress={0.75}
        showsText
        size={60}
        thickness={5}
        formatText={(value) => `${Math.round(value * 100)}%`}
        strokeCap="round"
        endAngle={0.9}
        segmentCount={32}
        direction="counter-clockwise"
        fill="#ffffff"
        unfilledColor="#eeeeee"
      />
      <Circle indeterminate />
      <Pie progress={0.3} unfilledColor="#eeeeee" borderWidth={2} />
      <Pie indeterminate direction="counter-clockwise" />
      <CircleSnail
        color={["#ff0000", "#00ff00"]}
        duration={900}
        spinDuration={4000}
        hidesWhenStopped
        animating
      />
      <Bar>{DEFAULT_COLOR}</Bar>
    </>
  );
}
