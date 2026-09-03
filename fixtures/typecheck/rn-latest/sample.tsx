import * as React from 'react';
import Collapsible, {Accordion} from '@ruban-labs/react-native-collapsible';
import AccordionDeep from '@ruban-labs/react-native-collapsible/Accordion';
import {
  Bar,
  Circle,
  CircleSnail,
  Pie,
  DEFAULT_COLOR,
} from '@ruban-labs/react-native-progress';
import {Dialog} from '@ruban-labs/react-native-ui-dialog';
import {Checkbox} from '@ruban-labs/react-native-ui-form/checkbox';
import {Field, FieldLabel} from '@ruban-labs/react-native-ui-form/field';
import {Input} from '@ruban-labs/react-native-ui-form/input';
import {RadioGroup, RadioGroupItem} from '@ruban-labs/react-native-ui-form/radio-group';
import {Select} from '@ruban-labs/react-native-ui-form/select';
import {Textarea} from '@ruban-labs/react-native-ui-form/textarea';
import {OverlayProvider} from '@ruban-labs/react-native-ui-overlay';
import {BottomSheetModal} from '@ruban-labs/react-native-ui-sheet';
import {RubanThemeProvider} from '@ruban-labs/react-native-ui-theme';

export function Sample(): React.ReactElement {
  const sections = ['FIRST', 'SECOND'] as const;

  return (
    <>
      <RubanThemeProvider mode="light">
        <OverlayProvider>
          <Dialog.Root>
            <Dialog.Content><FieldLabel>Dialog</FieldLabel></Dialog.Content>
          </Dialog.Root>
          <BottomSheetModal visible={false} title="Sheet" onDismiss={() => undefined}>
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
            <Select options={[{label: 'One', value: 'one'}]} value="one" />
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
        renderHeader={section => <Bar>{section}</Bar>}
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
        color={['#ff0000', '#00ff00']}
        duration={900}
        spinDuration={4000}
        hidesWhenStopped
        animating
      />
      <Bar>{DEFAULT_COLOR}</Bar>
    </>
  );
}
