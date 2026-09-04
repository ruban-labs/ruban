import * as React from "react";
import { useColorScheme } from "react-native";
import { rubanSemanticColors, type RubanThemeMode } from "./theme-colors";

export type RubanColors = {
  mode: "light" | "dark";
  canvas: string;
  surface: string;
  surfaceRaised: string;
  choiceSurface: string;
  navigationSurface: string;
  navigationActive: string;
  ink: string;
  muted: string;
  faint: string;
  border: string;
  borderStrong: string;
  accent: string;
  accentPressed: string;
  accentSoft: string;
  alert: string;
  alertPressed: string;
  alertSoft: string;
  alertForeground: string;
  success: string;
  successSoft: string;
  contrast: string;
  contrastAccent: string;
  inverse: string;
  inverseMuted: string;
  inverseBorder: string;
  focusRing: string;
};

function createRubanColors(mode: RubanThemeMode): RubanColors {
  const theme = rubanSemanticColors[mode];

  return {
    mode,
    canvas: theme["surface-page"],
    surface: theme["surface-card"],
    surfaceRaised: theme["surface-card-muted"],
    choiceSurface: theme["surface-choice"],
    navigationSurface: theme["surface-navigation"],
    navigationActive: theme["surface-navigation-active"],
    ink: theme["text-primary"],
    muted: theme["text-secondary"],
    faint: theme["text-tertiary"],
    border: theme["border-default"],
    borderStrong: theme["border-strong"],
    accent: theme["action-primary"],
    accentPressed: theme["action-primary-pressed"],
    accentSoft: theme["surface-selected"],
    alert: theme["action-alert"],
    alertPressed: theme["action-alert-pressed"],
    alertSoft: theme["surface-alert"],
    alertForeground: theme["text-on-alert"],
    success: theme["text-live"],
    successSoft: theme["surface-live"],
    contrast: theme["surface-contrast"],
    contrastAccent: theme["contrast-accent"],
    inverse: theme["text-inverse"],
    inverseMuted: theme["text-inverse-muted"],
    inverseBorder: theme["border-inverse"],
    focusRing: theme["focus-ring"],
  };
}

export const lightColors = createRubanColors("light");
export const darkColors = createRubanColors("dark");
export const rubanColors = { light: lightColors, dark: darkColors } as const;

const RubanThemeContext = React.createContext<RubanColors | null>(null);

export type RubanThemeProviderProps = {
  mode: RubanThemeMode;
  children: React.ReactNode;
};

export function RubanThemeProvider({
  mode,
  children,
}: RubanThemeProviderProps): React.ReactElement {
  return React.createElement(
    RubanThemeContext.Provider,
    { value: rubanColors[mode] },
    children
  );
}

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 44,
};

export const radius = {
  sm: 2,
  md: 4,
  lg: 0,
  pill: 999,
};

export function useRubanColors(): RubanColors {
  const overriddenColors = React.useContext(RubanThemeContext);
  const systemMode = useColorScheme();
  return overriddenColors || (systemMode === "dark" ? darkColors : lightColors);
}
