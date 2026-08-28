import * as React from 'react';
import {
  StyleSheet,
  Text,
  View,
  type TextProps,
  type ViewProps,
} from 'react-native';
import {radius, spacing, useRubanColors, type RubanColors} from '../../design/tokens';

export const cardTones = ['default', 'muted', 'selected', 'alert', 'live', 'contrast'] as const;
export type CardTone = (typeof cardTones)[number];

type CardPalette = {
  background: string;
  border: string;
  foreground: string;
  muted: string;
  accent: string;
};

const CardPaletteContext = React.createContext<CardPalette | null>(null);

function getCardPalette(tone: CardTone, colors: RubanColors): CardPalette {
  if (tone === 'muted') {
    return {
      background: colors.surfaceRaised,
      border: colors.border,
      foreground: colors.ink,
      muted: colors.muted,
      accent: colors.accent,
    };
  }

  if (tone === 'selected') {
    return {
      background: colors.accentSoft,
      border: colors.accent,
      foreground: colors.ink,
      muted: colors.muted,
      accent: colors.accent,
    };
  }

  if (tone === 'alert') {
    return {
      background: colors.alertSoft,
      border: colors.alert,
      foreground: colors.ink,
      muted: colors.muted,
      accent: colors.alert,
    };
  }

  if (tone === 'live') {
    return {
      background: colors.successSoft,
      border: colors.success,
      foreground: colors.ink,
      muted: colors.muted,
      accent: colors.success,
    };
  }

  if (tone === 'contrast') {
    return {
      background: colors.contrast,
      border: colors.inverseBorder,
      foreground: colors.inverse,
      muted: colors.inverseMuted,
      accent: colors.contrastAccent,
    };
  }

  return {
    background: colors.surface,
    border: colors.border,
    foreground: colors.ink,
    muted: colors.muted,
    accent: colors.accent,
  };
}

function useCardPalette(): CardPalette {
  const colors = useRubanColors();
  return (
    React.useContext(CardPaletteContext) ?? {
      background: colors.surface,
      border: colors.border,
      foreground: colors.ink,
      muted: colors.muted,
      accent: colors.accent,
    }
  );
}

export function Card({tone = 'default', style, children, ...viewProps}: ViewProps & {tone?: CardTone}): React.ReactElement {
  const colors = useRubanColors();
  const palette = getCardPalette(tone, colors);

  return (
    <CardPaletteContext.Provider value={palette}>
      <View
        {...viewProps}
        style={[
          styles.card,
          {backgroundColor: palette.background, borderColor: palette.border},
          style,
        ]}>
        {children}
      </View>
    </CardPaletteContext.Provider>
  );
}

export function CardHeader({style, ...viewProps}: ViewProps): React.ReactElement {
  return <View {...viewProps} style={[styles.header, style]} />;
}

export function CardTitle({style, ...textProps}: TextProps): React.ReactElement {
  const palette = useCardPalette();
  return <Text {...textProps} style={[styles.title, {color: palette.foreground}, style]} />;
}

export function CardDescription({style, ...textProps}: TextProps): React.ReactElement {
  const palette = useCardPalette();
  return <Text {...textProps} style={[styles.description, {color: palette.muted}, style]} />;
}

export function CardAction({style, ...viewProps}: ViewProps): React.ReactElement {
  return <View {...viewProps} style={[styles.action, style]} />;
}

export function CardActionText({style, ...textProps}: TextProps): React.ReactElement {
  const palette = useCardPalette();
  return <Text {...textProps} style={[styles.actionText, {color: palette.accent}, style]} />;
}

export function CardContent({style, ...viewProps}: ViewProps): React.ReactElement {
  return <View {...viewProps} style={[styles.content, style]} />;
}

export function CardFooter({style, ...viewProps}: ViewProps): React.ReactElement {
  const palette = useCardPalette();
  return <View {...viewProps} style={[styles.footer, {borderTopColor: palette.border}, style]} />;
}

export function CardMeta({style, ...textProps}: TextProps): React.ReactElement {
  const palette = useCardPalette();
  return <Text {...textProps} style={[styles.meta, {color: palette.muted}, style]} />;
}

const styles = StyleSheet.create({
  card: {borderWidth: 1, borderRadius: radius.lg, overflow: 'hidden'},
  header: {padding: spacing.md, paddingRight: 84, position: 'relative'},
  title: {fontSize: 18, lineHeight: 23, fontWeight: '800', letterSpacing: -0.25},
  description: {marginTop: 5, fontSize: 11, lineHeight: 15, fontWeight: '700', letterSpacing: 0.55},
  action: {position: 'absolute', top: spacing.md, right: spacing.md},
  actionText: {fontSize: 9, lineHeight: 12, fontWeight: '900', letterSpacing: 1},
  content: {paddingHorizontal: spacing.md, paddingBottom: spacing.md},
  footer: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  meta: {fontSize: 10, lineHeight: 14, fontWeight: '800', letterSpacing: 0.8},
});
