import * as React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useRubanColors } from '../design/tokens';

function iconInitials(label: string): string {
  return label.trim().slice(0, 2).toUpperCase() || '?';
}

export const PortfolioIcon = React.memo(function PortfolioIconView({
  logoUrl,
  label,
  size = 38,
}: {
  logoUrl?: string;
  label: string;
  size?: number;
}): React.ReactElement {
  const colors = useRubanColors();
  const [loadedUrl, setLoadedUrl] = React.useState<string | null>(null);
  const [failedUrl, setFailedUrl] = React.useState<string | null>(null);
  const canLoad = Boolean(logoUrl && failedUrl !== logoUrl);
  const loaded = Boolean(logoUrl && loadedUrl === logoUrl);

  return (
    <View
      accessible={false}
      style={[
        styles.root,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.accentSoft,
        },
      ]}
    >
      <Text
        style={[
          styles.initials,
          { color: colors.accent, fontSize: Math.max(10, size * 0.31) },
        ]}
      >
        {iconInitials(label)}
      </Text>
      {canLoad && logoUrl ? (
        <Image
          source={{ uri: logoUrl, cache: 'force-cache' }}
          resizeMode="contain"
          fadeDuration={0}
          onLoad={() => setLoadedUrl(logoUrl)}
          onError={() => setFailedUrl(logoUrl)}
          style={[
            styles.image,
            { backgroundColor: colors.surface },
            loaded ? styles.imageLoaded : styles.imageLoading,
          ]}
        />
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initials: { lineHeight: 18, fontWeight: '900' },
  image: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  imageLoaded: { opacity: 1 },
  imageLoading: { opacity: 0 },
});
