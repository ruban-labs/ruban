export const rubanColorRoles = ['ink', 'cobalt', 'signal', 'acid'] as const;
export const rubanOpacitySteps = [100, 75, 30, 15] as const;

export type RubanColorRole = (typeof rubanColorRoles)[number];
export type RubanOpacityStep = (typeof rubanOpacitySteps)[number];
export type RubanGradientColorKey = `${RubanColorRole}-${RubanOpacityStep}`;

const lightThemeColors = {
  'ink-100': 'rgba(16, 17, 20, 1)',
  'ink-75': 'rgba(16, 17, 20, 0.75)',
  'ink-30': 'rgba(16, 17, 20, 0.3)',
  'ink-15': 'rgba(16, 17, 20, 0.15)',
  'cobalt-100': 'rgba(49, 87, 255, 1)',
  'cobalt-75': 'rgba(49, 87, 255, 0.75)',
  'cobalt-30': 'rgba(49, 87, 255, 0.3)',
  'cobalt-15': 'rgba(49, 87, 255, 0.15)',
  'signal-100': 'rgba(255, 78, 66, 1)',
  'signal-75': 'rgba(255, 78, 66, 0.75)',
  'signal-30': 'rgba(255, 78, 66, 0.3)',
  'signal-15': 'rgba(255, 78, 66, 0.15)',
  'acid-100': 'rgba(217, 255, 69, 1)',
  'acid-75': 'rgba(217, 255, 69, 0.75)',
  'acid-30': 'rgba(217, 255, 69, 0.3)',
  'acid-15': 'rgba(217, 255, 69, 0.15)',
  'neutral-canvas': 'rgba(243, 244, 246, 1)',
  'neutral-surface': 'rgba(255, 255, 255, 1)',
  'neutral-soft': 'rgba(16, 17, 20, 0.08)',
  'neutral-line': 'rgba(216, 219, 226, 1)',
  'neutral-muted': 'rgba(16, 17, 20, 0.58)',
  'editorial': 'rgba(20, 33, 61, 1)',
  'contrast-surface': 'rgba(16, 17, 20, 1)',
  'contrast-text': 'rgba(255, 255, 255, 1)',
  'contrast-muted': 'rgba(255, 255, 255, 0.46)',
  'contrast-line': 'rgba(255, 255, 255, 0.16)',
  'contrast-accent': 'rgba(217, 255, 69, 1)',
} as const;

const darkThemeColors = {
  'ink-100': 'rgba(244, 246, 250, 1)',
  'ink-75': 'rgba(244, 246, 250, 0.75)',
  'ink-30': 'rgba(244, 246, 250, 0.3)',
  'ink-15': 'rgba(244, 246, 250, 0.15)',
  'cobalt-100': 'rgba(120, 144, 255, 1)',
  'cobalt-75': 'rgba(120, 144, 255, 0.75)',
  'cobalt-30': 'rgba(120, 144, 255, 0.3)',
  'cobalt-15': 'rgba(120, 144, 255, 0.15)',
  'signal-100': 'rgba(255, 106, 97, 1)',
  'signal-75': 'rgba(255, 106, 97, 0.75)',
  'signal-30': 'rgba(255, 106, 97, 0.3)',
  'signal-15': 'rgba(255, 106, 97, 0.15)',
  'acid-100': 'rgba(224, 255, 102, 1)',
  'acid-75': 'rgba(224, 255, 102, 0.75)',
  'acid-30': 'rgba(224, 255, 102, 0.3)',
  'acid-15': 'rgba(224, 255, 102, 0.15)',
  'neutral-canvas': 'rgba(9, 11, 16, 1)',
  'neutral-surface': 'rgba(19, 22, 29, 1)',
  'neutral-soft': 'rgba(244, 246, 250, 0.15)',
  'neutral-line': 'rgba(244, 246, 250, 0.14)',
  'neutral-muted': 'rgba(244, 246, 250, 0.56)',
  'editorial': 'rgba(220, 227, 255, 1)',
  'contrast-surface': 'rgba(244, 246, 250, 1)',
  'contrast-text': 'rgba(16, 17, 20, 1)',
  'contrast-muted': 'rgba(16, 17, 20, 0.55)',
  'contrast-line': 'rgba(16, 17, 20, 0.18)',
  'contrast-accent': 'rgba(49, 87, 255, 1)',
} as const satisfies Record<keyof typeof lightThemeColors, string>;

export const rubanThemeColors = {
  light: lightThemeColors,
  dark: darkThemeColors,
} as const;

export type RubanThemeMode = keyof typeof rubanThemeColors;
export type RubanThemeColorVariantKey = keyof typeof lightThemeColors;
export type RubanThemeColorVariants = Record<RubanThemeColorVariantKey, string>;

const lightSemanticColors = {
  'surface-page': lightThemeColors['neutral-canvas'],
  'surface-card': lightThemeColors['neutral-surface'],
  'surface-card-muted': lightThemeColors['ink-15'],
  'surface-choice': lightThemeColors['neutral-soft'],
  'surface-navigation': lightThemeColors['neutral-surface'],
  'surface-navigation-active': lightThemeColors['cobalt-15'],
  'surface-selected': lightThemeColors['cobalt-15'],
  'surface-alert': lightThemeColors['signal-15'],
  'surface-live': lightThemeColors['acid-30'],
  'surface-contrast': lightThemeColors['contrast-surface'],
  'text-primary': lightThemeColors['ink-100'],
  'text-secondary': lightThemeColors['ink-75'],
  'text-tertiary': lightThemeColors['neutral-muted'],
  'text-inverse': lightThemeColors['contrast-text'],
  'text-inverse-muted': lightThemeColors['contrast-muted'],
  'text-on-alert': lightThemeColors['ink-100'],
  'text-alert': lightThemeColors['signal-100'],
  'text-live': lightThemeColors['ink-100'],
  'border-default': lightThemeColors['ink-15'],
  'border-strong': lightThemeColors['ink-30'],
  'border-inverse': lightThemeColors['contrast-line'],
  'action-primary': lightThemeColors['cobalt-100'],
  'action-primary-pressed': lightThemeColors['cobalt-75'],
  'action-alert': lightThemeColors['signal-100'],
  'action-alert-pressed': lightThemeColors['signal-75'],
  'focus-ring': lightThemeColors['cobalt-75'],
  'contrast-accent': lightThemeColors['contrast-accent'],
} as const;

const darkSemanticColors = {
  'surface-page': darkThemeColors['neutral-canvas'],
  'surface-card': darkThemeColors['ink-15'],
  'surface-card-muted': darkThemeColors['ink-30'],
  'surface-choice': darkThemeColors['neutral-soft'],
  'surface-navigation': darkThemeColors['neutral-surface'],
  'surface-navigation-active': darkThemeColors['cobalt-15'],
  'surface-selected': darkThemeColors['cobalt-30'],
  'surface-alert': darkThemeColors['signal-30'],
  'surface-live': darkThemeColors['acid-15'],
  'surface-contrast': darkThemeColors['contrast-surface'],
  'text-primary': darkThemeColors['ink-100'],
  'text-secondary': darkThemeColors['ink-75'],
  'text-tertiary': darkThemeColors['neutral-muted'],
  'text-inverse': darkThemeColors['contrast-text'],
  'text-inverse-muted': darkThemeColors['contrast-muted'],
  'text-on-alert': darkThemeColors['contrast-text'],
  'text-alert': darkThemeColors['signal-100'],
  'text-live': darkThemeColors['acid-100'],
  'border-default': darkThemeColors['ink-15'],
  'border-strong': darkThemeColors['ink-30'],
  'border-inverse': darkThemeColors['contrast-line'],
  'action-primary': darkThemeColors['cobalt-100'],
  'action-primary-pressed': darkThemeColors['cobalt-75'],
  'action-alert': darkThemeColors['signal-100'],
  'action-alert-pressed': darkThemeColors['signal-75'],
  'focus-ring': darkThemeColors['cobalt-75'],
  'contrast-accent': darkThemeColors['contrast-accent'],
} as const satisfies Record<keyof typeof lightSemanticColors, string>;

export const rubanSemanticColors = {
  light: lightSemanticColors,
  dark: darkSemanticColors,
} as const;

export type RubanSemanticColorKey = keyof typeof lightSemanticColors;
export type RubanSemanticColors = Record<RubanSemanticColorKey, string>;
