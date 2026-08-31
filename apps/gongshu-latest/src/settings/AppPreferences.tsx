import * as React from 'react';

export const appearancePreferences = ['system', 'light', 'dark'] as const;

export type AppearancePreference = (typeof appearancePreferences)[number];

type AppPreferences = {
  appearance: AppearancePreference;
  setAppearance: (appearance: AppearancePreference) => void;
};

const AppPreferencesContext = React.createContext<AppPreferences | null>(null);

export function AppPreferencesProvider({children}: {children: React.ReactNode}): React.ReactElement {
  const [appearance, setAppearance] = React.useState<AppearancePreference>('system');
  const value = React.useMemo<AppPreferences>(
    () => ({appearance, setAppearance}),
    [appearance]
  );

  return <AppPreferencesContext.Provider value={value}>{children}</AppPreferencesContext.Provider>;
}

export function useAppPreferences(): AppPreferences {
  const preferences = React.useContext(AppPreferencesContext);

  if (preferences == null) {
    throw new Error('useAppPreferences must be used within AppPreferencesProvider');
  }

  return preferences;
}
