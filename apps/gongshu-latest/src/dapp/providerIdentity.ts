import type { Eip6963ProviderMetadata } from '@ruban-labs/react-native-dapp-bridge';
import {
  appEnvironment,
  type RubanAppEnvironment,
} from '../runtime/appEnvironment';
import { rubanProviderIcons } from './generatedProviderIcons';

const names: Record<RubanAppEnvironment, string> = {
  production: 'Ruban',
  regression: 'Ruban Regression',
  debug: 'Ruban Dev',
};

export const rubanDappProviderInfo: Eip6963ProviderMetadata = {
  name: names[appEnvironment],
  icon: rubanProviderIcons[appEnvironment],
  rdns:
    appEnvironment === 'production'
      ? 'work.ruban-labs.mobile'
      : `work.ruban-labs.mobile.${appEnvironment}`,
};
