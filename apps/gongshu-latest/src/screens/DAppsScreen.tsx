import {Dialog} from '@ruban-labs/react-native-ui-dialog';
import {Input} from '@ruban-labs/react-native-ui-form/input';
import type {BottomTabScreenProps} from '@react-navigation/bottom-tabs';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import * as React from 'react';
import {StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {RubanScreen} from '../components/RubanPrimitives';
import {useRubanColors} from '../design/tokens';
import type {RootStackParamList, TabParamList} from '../navigation/types';

type Props = BottomTabScreenProps<TabParamList, 'DApps'>;

const dapps = [
  {name: 'Test DApp', domain: 'metamask.github.io', url: 'https://metamask.github.io/test-dapp/'},
  {name: 'Uniswap', domain: 'app.uniswap.org', url: 'https://app.uniswap.org/'},
  {name: 'Aave', domain: 'app.aave.com', url: 'https://app.aave.com/'},
  {name: 'Lido', domain: 'stake.lido.fi', url: 'https://stake.lido.fi/'},
  {name: 'OpenSea', domain: 'opensea.io', url: 'https://opensea.io/'},
] as const;

export default function DAppsScreen({navigation}: Props): React.ReactElement {
  const colors = useRubanColors();
  const root = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
  const [customOpen, setCustomOpen] = React.useState(false);
  const [url, setUrl] = React.useState('https://');

  const open = React.useCallback((target: string, title?: string) => {
    root?.navigate('DAppBrowser', {url: target, title});
  }, [root]);

  const openCustom = React.useCallback(() => {
    let normalized = url.trim();
    if (!/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`;
    if (!/^https?:\/\/[^\s/]+/i.test(normalized)) return;
    setCustomOpen(false);
    open(normalized);
  }, [open, url]);

  return (
    <RubanScreen testID="screen-dapps">
      <View style={styles.header}>
        <Text style={[styles.wordmark, {color: colors.ink}]}>RUBAN / DAPPS</Text>
        <TouchableOpacity onPress={() => setCustomOpen(true)}>
          <Text style={[styles.openUrl, {color: colors.accent}]}>OPEN URL</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.grid}>
        {dapps.map((dapp, index) => (
          <TouchableOpacity
            key={dapp.name}
            activeOpacity={0.76}
            onPress={() => open(dapp.url, dapp.name)}
            style={[
              styles.card,
              {backgroundColor: index === 0 ? colors.contrast : colors.surface, borderColor: colors.borderStrong},
            ]}>
            <Text style={[styles.index, {color: index === 0 ? colors.contrastAccent : colors.accent}]}>0{index + 1}</Text>
            <View>
              <Text style={[styles.cardTitle, {color: index === 0 ? colors.inverse : colors.ink}]}>{dapp.name}</Text>
              <Text style={[styles.cardMeta, {color: index === 0 ? colors.inverseMuted : colors.faint}]}>{dapp.domain}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <Dialog.Root open={customOpen} onOpenChange={setCustomOpen}>
        <Dialog.Content accessibilityLabel="Open DApp URL">
          <Dialog.Header>
            <Dialog.Title>Open URL</Dialog.Title>
          </Dialog.Header>
          <Input value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
          <Dialog.Footer>
            <TouchableOpacity onPress={() => setCustomOpen(false)} style={styles.dialogButton}>
              <Text style={[styles.dialogText, {color: colors.faint}]}>CANCEL</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={openCustom} style={[styles.dialogButton, {backgroundColor: colors.ink}]}>
              <Text style={[styles.dialogText, {color: colors.inverse}]}>OPEN</Text>
            </TouchableOpacity>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Root>
    </RubanScreen>
  );
}

const styles = StyleSheet.create({
  header: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  wordmark: {fontSize: 11, lineHeight: 15, fontWeight: '900', letterSpacing: 1.7},
  openUrl: {fontSize: 9, lineHeight: 13, fontWeight: '900', letterSpacing: 1.1},
  grid: {marginTop: 28, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between'},
  card: {width: '48.5%', height: 168, marginBottom: 12, padding: 14, borderWidth: 1, justifyContent: 'space-between'},
  index: {fontSize: 10, fontWeight: '900', letterSpacing: 1},
  cardTitle: {fontSize: 22, lineHeight: 27, fontWeight: '800', letterSpacing: -0.7},
  cardMeta: {marginTop: 5, fontSize: 8, lineHeight: 12, fontWeight: '800', letterSpacing: 0.55},
  dialogButton: {minWidth: 82, minHeight: 42, marginLeft: 8, alignItems: 'center', justifyContent: 'center'},
  dialogText: {fontSize: 10, fontWeight: '900', letterSpacing: 1},
});
