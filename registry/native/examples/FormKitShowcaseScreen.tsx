import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as React from 'react';
import { StyleSheet, View } from 'react-native';
import { buildInfo } from '../../buildInfo';
import {
  ComponentShowcaseScreen,
  ShowcaseChoice,
  ShowcaseControlGroup,
  ShowcaseDataRow,
  ShowcaseDataTable,
  ShowcaseDeepLink,
  ShowcaseSection,
  ShowcaseSpecimen,
  ShowcaseStage,
} from '../../components/showcase/ComponentShowcase';
import { Checkbox } from '../../components/ui/Checkbox';
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '../../components/ui/Field';
import { Input } from '../../components/ui/Input';
import { RadioGroup, RadioGroupItem } from '../../components/ui/RadioGroup';
import { Select, type SelectOption } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { spacing } from '../../design/tokens';
import type { RubanThemeMode } from '../../design/theme-colors';
import type { RootStackParamList } from '../../navigation/types';

export const formComponentIds = [
  'field',
  'input',
  'textarea',
  'checkbox',
  'radio-group',
  'select',
] as const;

export type FormComponentId = (typeof formComponentIds)[number];
type Props = NativeStackScreenProps<RootStackParamList, 'ComponentDetail'> & {
  onBack: () => void;
};
type ComponentState = 'default' | 'invalid' | 'disabled';

const componentStates: readonly ComponentState[] = [
  'default',
  'invalid',
  'disabled',
];

const componentMetadata: Record<
  FormComponentId,
  { category: string; index: string; name: string }
> = {
  field: { category: 'FORM', index: '06', name: 'Field' },
  input: { category: 'FORM', index: '07', name: 'Input' },
  textarea: { category: 'FORM', index: '08', name: 'Textarea' },
  checkbox: { category: 'CONTROL', index: '09', name: 'Checkbox' },
  'radio-group': { category: 'CONTROL', index: '10', name: 'Radio Group' },
  select: { category: 'CONTROL', index: '11', name: 'Select' },
};

const choiceOptions: ReadonlyArray<SelectOption> = [
  { value: 'craft', label: 'Craft', description: 'Measured and deliberate' },
  { value: 'code', label: 'Code', description: 'Direct and technical' },
  { value: 'system', label: 'System', description: 'Follow the platform' },
];

export function isFormComponentId(value: string): value is FormComponentId {
  return formComponentIds.includes(value as FormComponentId);
}

function parseOption<T extends string>(
  value: string | undefined,
  options: readonly T[],
  fallback: T,
): T {
  return options.includes(value as T) ? (value as T) : fallback;
}

function valueOptions(component: FormComponentId): readonly string[] {
  if (component === 'checkbox') {
    return ['unchecked', 'checked'];
  }
  if (component === 'radio-group' || component === 'select') {
    return choiceOptions.map(option => option.value);
  }
  return [];
}

function PreviewControl({
  component,
  state,
  value,
  onValueChange,
}: {
  component: FormComponentId;
  state: ComponentState;
  value: string;
  onValueChange?: (value: string) => void;
}): React.ReactElement {
  const invalid = state === 'invalid';
  const disabled = state === 'disabled';

  if (component === 'field') {
    return (
      <Field invalid={invalid} disabled={disabled}>
        <FieldLabel required>Project name</FieldLabel>
        <Input value="Ruban Mobile" editable={false} />
        {invalid ? (
          <FieldError>Name is required</FieldError>
        ) : (
          <FieldDescription>PUBLIC LABEL</FieldDescription>
        )}
      </Field>
    );
  }

  if (component === 'input') {
    return (
      <Input
        value="Ruban Mobile"
        editable={false}
        invalid={invalid}
        disabled={disabled}
      />
    );
  }

  if (component === 'textarea') {
    return (
      <Textarea
        value="Build precise interfaces."
        editable={false}
        invalid={invalid}
        disabled={disabled}
        minRows={3}
      />
    );
  }

  if (component === 'checkbox') {
    return (
      <Field invalid={invalid} disabled={disabled}>
        <Checkbox
          checked={value === 'checked'}
          label="Include compatibility report"
          onCheckedChange={checked => {
            if (onValueChange) {
              onValueChange(checked ? 'checked' : 'unchecked');
            }
          }}
        />
      </Field>
    );
  }

  if (component === 'radio-group') {
    return (
      <Field invalid={invalid} disabled={disabled}>
        <RadioGroup value={value} onValueChange={onValueChange}>
          <RadioGroupItem value="craft" label="Craft" />
          <RadioGroupItem value="code" label="Code" />
          <RadioGroupItem value="system" label="System" />
        </RadioGroup>
      </Field>
    );
  }

  return (
    <Field invalid={invalid} disabled={disabled}>
      <Select
        value={value}
        options={choiceOptions}
        sheetTitle="Interface direction"
        onValueChange={onValueChange}
      />
    </Field>
  );
}

function LiveSpecimen({
  component,
  state,
  value,
  onValueChange,
}: {
  component: FormComponentId;
  state: ComponentState;
  value: string;
  onValueChange: (value: string) => void;
}): React.ReactElement {
  const [inputValue, setInputValue] = React.useState('Ruban Mobile');
  const [notes, setNotes] = React.useState('Build precise interfaces.');
  const invalid = state === 'invalid';
  const disabled = state === 'disabled';

  if (component === 'input') {
    return (
      <Field invalid={invalid} disabled={disabled}>
        <FieldLabel>Project name</FieldLabel>
        <Input
          testID="form-kit-input-live"
          value={inputValue}
          onChangeText={setInputValue}
          placeholder="Project name"
        />
        {invalid ? <FieldError>Name is required</FieldError> : null}
      </Field>
    );
  }

  if (component === 'textarea') {
    return (
      <Field invalid={invalid} disabled={disabled}>
        <FieldLabel>Notes</FieldLabel>
        <Textarea
          testID="form-kit-textarea-live"
          value={notes}
          onChangeText={setNotes}
          placeholder="Add notes"
        />
        {invalid ? (
          <FieldError>Keep this under 240 characters</FieldError>
        ) : null}
      </Field>
    );
  }

  return (
    <PreviewControl
      component={component}
      state={state}
      value={value}
      onValueChange={onValueChange}
    />
  );
}

export default function FormKitShowcaseScreen({
  route,
  navigation,
  onBack,
}: Props): React.ReactElement {
  const component = isFormComponentId(route.params.component)
    ? route.params.component
    : 'field';
  const metadata = componentMetadata[component];
  const theme = parseOption<RubanThemeMode>(
    route.params.theme,
    ['light', 'dark'],
    'light',
  );
  const state = parseOption<ComponentState>(
    route.params.state,
    componentStates,
    'default',
  );
  const values = valueOptions(component);
  const fallbackValue = component === 'checkbox' ? 'checked' : 'craft';
  const value =
    values.length > 0
      ? parseOption(route.params.variant, values, fallbackValue)
      : fallbackValue;
  const valueQuery = values.length > 0 ? `&variant=${value}` : '';
  const deepLink = `ruban://components/${component}?theme=${theme}&state=${state}${valueQuery}`;

  return (
    <ComponentShowcaseScreen
      index={metadata.index}
      name={metadata.name}
      category={metadata.category}
      distribution="SOURCE"
      status={String(buildInfo.edition) === 'latest' ? 'READY' : 'PREVIEW'}
      theme={theme}
      onThemeChange={nextTheme => navigation.setParams({ theme: nextTheme })}
      onBack={onBack}
    >
      <ShowcaseSection index="01" label="LIVE">
        <ShowcaseStage style={styles.stage}>
          <LiveSpecimen
            component={component}
            state={state}
            value={value}
            onValueChange={nextValue =>
              navigation.setParams({ variant: nextValue })
            }
          />
        </ShowcaseStage>
        <ShowcaseControlGroup label="STATE">
          {componentStates.map(option => (
            <ShowcaseChoice
              key={option}
              label={option.toUpperCase()}
              selected={state === option}
              onPress={() => navigation.setParams({ state: option })}
            />
          ))}
        </ShowcaseControlGroup>
        {values.length > 0 ? (
          <ShowcaseControlGroup label="VALUE">
            {values.map(option => (
              <ShowcaseChoice
                key={option}
                label={option.toUpperCase()}
                selected={value === option}
                onPress={() => navigation.setParams({ variant: option })}
              />
            ))}
          </ShowcaseControlGroup>
        ) : null}
      </ShowcaseSection>

      <ShowcaseSection index="02" label="STATES">
        <View style={styles.stack}>
          {componentStates.map(option => (
            <ShowcaseSpecimen
              key={option}
              label={option.toUpperCase()}
              style={styles.stackItem}
            >
              <PreviewControl
                component={component}
                state={option}
                value={value}
              />
            </ShowcaseSpecimen>
          ))}
        </View>
      </ShowcaseSection>

      <ShowcaseSection index="03" label="COMPOSITION">
        <ShowcaseSpecimen label="LABEL / CONTROL / MESSAGE">
          <Field invalid>
            <FieldLabel required>Component name</FieldLabel>
            <Input value={metadata.name} editable={false} />
            <FieldError>Use a unique name</FieldError>
          </Field>
        </ShowcaseSpecimen>
      </ShowcaseSection>

      <ShowcaseSection index="04" label="CONTRACT">
        <ShowcaseDataTable>
          <ShowcaseDataRow label="Delivery" value="SOURCE" />
          <ShowcaseDataRow label="Runtime deps" value="ZERO" />
          <ShowcaseDataRow label="Bare React Native" value="YES" />
          <ShowcaseDataRow label="State model" value="CONTROLLED" />
          <ShowcaseDataRow label="Architectures" value="OLD + NEW" />
        </ShowcaseDataTable>
        <ShowcaseDeepLink>{deepLink}</ShowcaseDeepLink>
      </ShowcaseSection>
    </ComponentShowcaseScreen>
  );
}

const styles = StyleSheet.create({
  stage: { minHeight: 230, alignItems: 'stretch' },
  stack: {},
  stackItem: { marginBottom: spacing.sm },
});
