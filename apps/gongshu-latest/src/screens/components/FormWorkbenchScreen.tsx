import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { buildInfo } from '../../buildInfo';
import {
  ComponentShowcaseScreen,
  ShowcaseDataRow,
  ShowcaseDataTable,
  ShowcaseDeepLink,
  ShowcaseSection,
} from '../../components/showcase/ComponentShowcase';
import { Button } from '../../components/ui/Button';
import { Checkbox } from '@ruban-labs/react-native-ui-form/checkbox';
import {
  Field,
  FieldError,
  FieldLabel,
} from '@ruban-labs/react-native-ui-form/field';
import { Input } from '@ruban-labs/react-native-ui-form/input';
import {
  RadioGroup,
  RadioGroupItem,
} from '@ruban-labs/react-native-ui-form/radio-group';
import {
  Select,
  type SelectOption,
} from '@ruban-labs/react-native-ui-form/select';
import { Textarea } from '@ruban-labs/react-native-ui-form/textarea';
import { spacing, useRubanColors } from '@ruban-labs/react-native-ui-theme';
import type { RubanThemeMode } from '@ruban-labs/react-native-ui-theme/colors';
import type { RootStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ComponentDetail'> & {
  onBack: () => void;
};

const channelOptions: ReadonlyArray<SelectOption> = [
  { value: 'email', label: 'Email' },
  { value: 'push', label: 'Push' },
  { value: 'none', label: 'None' },
];

function parseTheme(value: string | undefined): RubanThemeMode {
  return value === 'dark' ? 'dark' : 'light';
}

export default function FormWorkbenchScreen({
  route,
  navigation,
  onBack,
}: Props): React.ReactElement {
  const theme = parseTheme(route.params.theme);
  const [name, setName] = React.useState('Ada Lovelace');
  const [notes, setNotes] = React.useState('Ship the smallest useful surface.');
  const [direction, setDirection] = React.useState('craft');
  const [channel, setChannel] = React.useState('email');
  const [accepted, setAccepted] = React.useState(true);
  const [attempted, setAttempted] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const nameInvalid = attempted && name.trim().length === 0;
  const acceptedInvalid = attempted && !accepted;

  const submit = () => {
    setAttempted(true);
    setSaved(name.trim().length > 0 && accepted);
  };

  const markDirty = () => setSaved(false);

  return (
    <ComponentShowcaseScreen
      index="R1"
      name="Form Workbench"
      category="RECIPE"
      distribution="SOURCE"
      status={String(buildInfo.edition) === 'latest' ? 'READY' : 'PREVIEW'}
      theme={theme}
      onThemeChange={nextTheme => navigation.setParams({ theme: nextTheme })}
      onBack={onBack}
    >
      <ShowcaseSection index="01" label="LIVE">
        <View style={styles.form}>
          <Field invalid={nameInvalid}>
            <FieldLabel required>Name</FieldLabel>
            <Input
              testID="form-workbench-name"
              value={name}
              placeholder="Name"
              onChangeText={value => {
                setName(value);
                markDirty();
              }}
            />
            {nameInvalid ? <FieldError>Enter a name</FieldError> : null}
          </Field>

          <Field style={styles.field}>
            <FieldLabel>Notes</FieldLabel>
            <Textarea
              testID="form-workbench-notes"
              value={notes}
              minRows={3}
              onChangeText={value => {
                setNotes(value);
                markDirty();
              }}
            />
          </Field>

          <Field style={styles.field}>
            <FieldLabel>Direction</FieldLabel>
            <RadioGroup
              value={direction}
              onValueChange={value => {
                setDirection(value);
                markDirty();
              }}
            >
              <RadioGroupItem
                testID="form-workbench-direction-craft"
                value="craft"
                label="Craft"
              />
              <RadioGroupItem
                testID="form-workbench-direction-code"
                value="code"
                label="Code"
              />
              <RadioGroupItem
                testID="form-workbench-direction-system"
                value="system"
                label="System"
              />
            </RadioGroup>
          </Field>

          <Field style={styles.field}>
            <FieldLabel>Updates</FieldLabel>
            <Select
              testID="form-workbench-channel"
              value={channel}
              options={channelOptions}
              sheetTitle="Updates"
              onValueChange={value => {
                setChannel(value);
                markDirty();
              }}
            />
          </Field>

          <Field invalid={acceptedInvalid} style={styles.field}>
            <Checkbox
              testID="form-workbench-accepted"
              checked={accepted}
              label="Include compatibility evidence"
              onCheckedChange={value => {
                setAccepted(value);
                markDirty();
              }}
            />
            {acceptedInvalid ? (
              <FieldError>Required for this run</FieldError>
            ) : null}
          </Field>

          <Button testID="form-workbench-submit" fullWidth onPress={submit}>
            {'SAVE PROFILE'}
          </Button>

          {saved ? (
            <SavedStatus direction={direction} channel={channel} />
          ) : null}
        </View>
      </ShowcaseSection>

      <ShowcaseSection index="02" label="CONTRACT">
        <ShowcaseDataTable>
          <ShowcaseDataRow label="Components" value="06" />
          <ShowcaseDataRow label="Validation" value="INLINE" />
          <ShowcaseDataRow label="Selection" value="BOTTOM SHEET" />
          <ShowcaseDataRow label="State model" value="CONTROLLED" />
          <ShowcaseDataRow label="Runtime deps" value="ZERO" />
        </ShowcaseDataTable>
        <ShowcaseDeepLink>{`ruban://components/form?theme=${theme}`}</ShowcaseDeepLink>
      </ShowcaseSection>
    </ComponentShowcaseScreen>
  );
}

function SavedStatus({
  direction,
  channel,
}: {
  direction: string;
  channel: string;
}): React.ReactElement {
  const colors = useRubanColors();
  return (
    <View
      testID="form-workbench-saved"
      accessibilityLiveRegion="polite"
      style={[
        styles.saved,
        { backgroundColor: colors.successSoft, borderColor: colors.success },
      ]}
    >
      <Text style={[styles.savedLabel, { color: colors.success }]}>SAVED</Text>
      <Text style={[styles.savedValue, { color: colors.ink }]}>
        {direction.toUpperCase()} · {channel.toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { marginTop: spacing.md },
  field: { marginTop: spacing.lg },
  saved: {
    minHeight: 58,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  savedLabel: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
  savedValue: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
});
