import {
  BottomSheetFlatList,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { Input } from '@ruban-labs/react-native-ui-form/input';
import {
  DocumentIcon,
  EyeIcon,
  LockIcon,
  PlusIcon,
  type RubanIconProps,
  WalletIcon,
} from '@ruban-labs/react-native-ui-icons';
import type { WalletAccount } from '@ruban-labs/react-native-wallet-core';
import * as React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BottomSheetFlow,
  type BottomSheetFlowController,
} from '../components/ui/BottomSheetModal';
import { SelectionMark } from '../components/ui/SelectionMark';
import { radius, spacing, useRubanColors } from '../design/tokens';

type AddressSheetRoute = 'addresses' | 'add';

const ADDRESS_SHEET_SNAP_POINTS: Array<number | string> = ['58%'];

function shortAddress(address: string): string {
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

export function AddressSelectorSheet({
  visible,
  accounts,
  selectedAccountId,
  available,
  onSelect,
  onCreateWallet,
  onImportMnemonic,
  onImportPrivateKey,
  onAddWatch,
  onDismiss,
}: {
  visible: boolean;
  accounts: readonly WalletAccount[];
  selectedAccountId: string | null;
  available: boolean;
  onSelect: (accountId: string) => void;
  onCreateWallet: () => void;
  onImportMnemonic: () => void;
  onImportPrivateKey: () => void;
  onAddWatch: (label: string, address: string) => Promise<void>;
  onDismiss: () => void;
}): React.ReactElement {
  const colors = useRubanColors();
  const insets = useSafeAreaInsets();
  const [watchLabel, setWatchLabel] = React.useState('Watch account');
  const [watchAddress, setWatchAddress] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const pendingNativeActionRef = React.useRef<(() => void) | null>(null);

  React.useEffect(() => {
    if (!visible) {
      setWatchLabel('Watch account');
      setWatchAddress('');
      setSubmitting(false);
    }
  }, [visible]);

  const addWatch = React.useCallback(
    async (controller: BottomSheetFlowController<AddressSheetRoute>) => {
      setSubmitting(true);
      try {
        await onAddWatch(watchLabel, watchAddress);
        controller.dismiss();
      } catch (error) {
        Alert.alert(
          'Address',
          error instanceof Error ? error.message : 'Unable to add address',
        );
      } finally {
        setSubmitting(false);
      }
    },
    [onAddWatch, watchAddress, watchLabel],
  );

  const startNativeAction = React.useCallback(
    (action: () => void) => {
      pendingNativeActionRef.current = action;
      onDismiss();
    },
    [onDismiss],
  );

  const handleAfterDismiss = React.useCallback(() => {
    const action = pendingNativeActionRef.current;
    pendingNativeActionRef.current = null;
    action?.();
  }, []);

  const renderRightAction = React.useCallback(
    (controller: BottomSheetFlowController<AddressSheetRoute>) =>
      controller.route === 'addresses' ? (
        <Pressable
          testID="add-address"
          accessibilityRole="button"
          accessibilityLabel="Add address"
          hitSlop={8}
          onPress={() => controller.push('add')}
          style={({ pressed }) => [
            styles.headerAction,
            pressed ? styles.pressed : undefined,
          ]}
        >
          <PlusIcon size={26} color={colors.accent} />
        </Pressable>
      ) : null,
    [colors.accent],
  );

  const renderContent = React.useCallback(
    (controller: BottomSheetFlowController<AddressSheetRoute>) => {
      if (controller.route === 'add') {
        return (
          <BottomSheetScrollView
            testID="add-address-sheet"
            style={styles.scroll}
            bounces={false}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.addContent,
              { paddingBottom: Math.max(insets.bottom, spacing.lg) },
            ]}
          >
            <View
              style={[
                styles.watchForm,
                { backgroundColor: colors.surfaceRaised },
              ]}
            >
              <Input
                value={watchLabel}
                onChangeText={setWatchLabel}
                placeholder="Label"
                returnKeyType="next"
              />
              <Input
                value={watchAddress}
                onChangeText={setWatchAddress}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="0x…"
                returnKeyType="done"
                style={styles.fieldSpacing}
                onSubmitEditing={() => {
                  if (watchAddress.trim()) addWatch(controller);
                }}
              />
              <Pressable
                testID="confirm-add-watch-address"
                accessibilityRole="button"
                accessibilityLabel="Add watch address"
                accessibilityState={{
                  disabled: submitting || !watchAddress.trim(),
                }}
                disabled={submitting || !watchAddress.trim()}
                onPress={() => addWatch(controller)}
                style={({ pressed }) => [
                  styles.watchSubmit,
                  {
                    backgroundColor: watchAddress.trim()
                      ? colors.ink
                      : colors.choiceSurface,
                  },
                  pressed ? styles.pressed : undefined,
                ]}
              >
                <EyeIcon
                  size={20}
                  color={watchAddress.trim() ? colors.inverse : colors.faint}
                />
                <Text
                  style={[
                    styles.watchSubmitText,
                    {
                      color: watchAddress.trim()
                        ? colors.inverse
                        : colors.faint,
                    },
                  ]}
                >
                  {submitting ? 'ADDING' : 'ADD WATCH ADDRESS'}
                </Text>
              </Pressable>
            </View>

            <View style={styles.walletMethods}>
              <AddMethod
                label="Create wallet"
                icon={WalletIcon}
                disabled={!available}
                onPress={() => startNativeAction(onCreateWallet)}
              />
              <AddMethod
                label="Import phrase"
                icon={DocumentIcon}
                disabled={!available}
                onPress={() => startNativeAction(onImportMnemonic)}
              />
              <AddMethod
                label="Import private key"
                icon={LockIcon}
                disabled={!available}
                onPress={() => startNativeAction(onImportPrivateKey)}
              />
            </View>
          </BottomSheetScrollView>
        );
      }

      return (
        <BottomSheetFlatList
          testID="address-selector-list"
          style={styles.scroll}
          data={accounts}
          keyExtractor={account => account.id}
          bounces={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: Math.max(insets.bottom, spacing.sm) },
          ]}
          renderItem={({ item: account }) => {
            const selected = account.id === selectedAccountId;

            return (
              <Pressable
                testID={`address-option-${account.id}`}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${account.label}, ${account.address}`}
                onPress={() => {
                  onSelect(account.id);
                  controller.dismiss();
                }}
                style={({ pressed }) => [
                  styles.row,
                  { borderBottomColor: colors.border },
                  selected ? { backgroundColor: colors.accentSoft } : undefined,
                  pressed ? styles.pressed : undefined,
                ]}
              >
                <View
                  style={[
                    styles.addressMark,
                    { backgroundColor: colors.accentSoft },
                  ]}
                >
                  <Text
                    style={[styles.addressMarkText, { color: colors.accent }]}
                  >
                    {account.address.slice(2, 4).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.identity}>
                  <Text style={[styles.label, { color: colors.ink }]}>
                    {account.label}
                  </Text>
                  <Text style={[styles.address, { color: colors.faint }]}>
                    {shortAddress(account.address)}
                  </Text>
                </View>
                <SelectionMark selected={selected} />
              </Pressable>
            );
          }}
        />
      );
    },
    [
      accounts,
      addWatch,
      available,
      colors,
      insets.bottom,
      onCreateWallet,
      onImportMnemonic,
      onImportPrivateKey,
      onSelect,
      selectedAccountId,
      startNativeAction,
      submitting,
      watchAddress,
      watchLabel,
    ],
  );

  return (
    <BottomSheetFlow<AddressSheetRoute>
      visible={visible}
      initialRoute="addresses"
      title={controller =>
        controller.route === 'add' ? 'Add address' : undefined
      }
      renderRightAction={renderRightAction}
      renderContent={renderContent}
      onDismiss={onDismiss}
      onAfterDismiss={handleAfterDismiss}
      overlayId="wallet-address-selector"
      testID="address-selector-sheet"
      enableDynamicSizing={false}
      snapPoints={ADDRESS_SHEET_SNAP_POINTS}
    />
  );
}

function AddMethod({
  label,
  icon: Icon,
  disabled,
  onPress,
}: {
  label: string;
  icon: React.ComponentType<RubanIconProps>;
  disabled: boolean;
  onPress: () => void;
}): React.ReactElement {
  const colors = useRubanColors();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.method,
        { backgroundColor: colors.choiceSurface },
        pressed ? styles.pressed : undefined,
        disabled ? styles.disabled : undefined,
      ]}
    >
      <Icon size={22} color={colors.muted} />
      <Text style={[styles.methodLabel, { color: colors.ink }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerAction: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flex: 1 },
  list: { paddingTop: spacing.xs },
  row: {
    minHeight: 78,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
  },
  addressMark: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressMarkText: { fontSize: 12, lineHeight: 16, fontWeight: '900' },
  identity: { flex: 1, marginLeft: 13 },
  label: { fontSize: 16, lineHeight: 21, fontWeight: '800' },
  address: {
    marginTop: 2,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  addContent: {
    paddingTop: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  watchForm: { padding: spacing.md, borderRadius: radius.md },
  fieldSpacing: { marginTop: spacing.sm },
  watchSubmit: {
    minHeight: 48,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  watchSubmitText: {
    marginLeft: 9,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '900',
    letterSpacing: 0.75,
  },
  walletMethods: { marginTop: spacing.md },
  method: {
    minHeight: 56,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  methodLabel: {
    marginLeft: 12,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
  },
  pressed: { opacity: 0.62 },
  disabled: { opacity: 0.42 },
});
