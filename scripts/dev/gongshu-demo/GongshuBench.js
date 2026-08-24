// Gongshu Bench - the shared demo screen for every gongshu sample app.
// Kept ES2019-safe on purpose: it must run untransformed-era-compatible
// through the RN 0.66 floor. sync-gongshu.mjs copies this file into each
// app; edit it here, never the copies.

import * as React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Bar, Circle, CircleSnail, Pie } from '@ruban-labs/react-native-progress';

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function ControlButton({ label, onPress, testID }) {
  return (
    <TouchableOpacity testID={testID} onPress={onPress} style={styles.controlButton}>
      <Text style={styles.controlButtonText}>{label}</Text>
    </TouchableOpacity>
  );
}

function Section({ title, testID, children }) {
  return (
    <View testID={testID} style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export default function GongshuBench({ era }) {
  const [barProgress, setBarProgress] = React.useState(0.2);
  const [circleProgress, setCircleProgress] = React.useState(0.4);
  const [pieProgress, setPieProgress] = React.useState(0.6);
  const [snailAnimating, setSnailAnimating] = React.useState(true);

  return (
    <ScrollView testID="gongshu-bench" style={styles.root} contentContainerStyle={styles.content}>
      <Text testID="gongshu-header" style={styles.header}>
        Gongshu Bench
      </Text>
      <Text testID="gongshu-era" style={styles.subHeader}>
        era {era}
      </Text>

      <Section title="Bar" testID="section-bar">
        <Text testID="bar-value" style={styles.readout}>
          {Math.round(barProgress * 100)}%
        </Text>
        <Bar testID="bar-main" progress={barProgress} width={240} color="#c0392b" />
        <Bar testID="bar-indeterminate" indeterminate width={240} color="#c0392b" style={styles.spaced} />
        <View style={styles.controls}>
          <ControlButton testID="bar-dec" label="-10%" onPress={() => setBarProgress(clamp01(barProgress - 0.1))} />
          <ControlButton testID="bar-inc" label="+10%" onPress={() => setBarProgress(clamp01(barProgress + 0.1))} />
        </View>
      </Section>

      <Section title="Circle" testID="section-circle">
        <Text testID="circle-value" style={styles.readout}>
          {Math.round(circleProgress * 100)}%
        </Text>
        <View style={styles.row}>
          <Circle testID="circle-main" progress={circleProgress} size={64} showsText color="#c0392b" />
          <Circle testID="circle-segmented" progress={circleProgress} size={64} segmentCount={12} color="#c0392b" />
          <Circle testID="circle-indeterminate" indeterminate size={64} color="#c0392b" />
        </View>
        <View style={styles.controls}>
          <ControlButton testID="circle-dec" label="-10%" onPress={() => setCircleProgress(clamp01(circleProgress - 0.1))} />
          <ControlButton testID="circle-inc" label="+10%" onPress={() => setCircleProgress(clamp01(circleProgress + 0.1))} />
        </View>
      </Section>

      <Section title="Pie" testID="section-pie">
        <Text testID="pie-value" style={styles.readout}>
          {Math.round(pieProgress * 100)}%
        </Text>
        <View style={styles.row}>
          <Pie testID="pie-main" progress={pieProgress} size={64} color="#c0392b" />
          <Pie testID="pie-indeterminate" indeterminate size={64} direction="counter-clockwise" color="#c0392b" />
        </View>
        <View style={styles.controls}>
          <ControlButton testID="pie-dec" label="-10%" onPress={() => setPieProgress(clamp01(pieProgress - 0.1))} />
          <ControlButton testID="pie-inc" label="+10%" onPress={() => setPieProgress(clamp01(pieProgress + 0.1))} />
        </View>
      </Section>

      <Section title="CircleSnail" testID="section-snail">
        <CircleSnail testID="snail-main" animating={snailAnimating} hidesWhenStopped color={['#c0392b', '#2980b9', '#27ae60']} />
        <View style={styles.controls}>
          <ControlButton
            testID="snail-toggle"
            label={snailAnimating ? 'stop' : 'start'}
            onPress={() => setSnailAnimating(!snailAnimating)}
          />
        </View>
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fafafa' },
  content: { padding: 24 },
  header: { fontSize: 28, fontWeight: '700', color: '#2c3e50' },
  subHeader: { fontSize: 14, color: '#7f8c8d', marginBottom: 16 },
  section: { marginTop: 24, padding: 16, backgroundColor: '#ffffff', borderRadius: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#2c3e50', marginBottom: 12 },
  readout: { fontSize: 14, color: '#7f8c8d', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  spaced: { marginTop: 12 },
  controls: { flexDirection: 'row', marginTop: 12 },
  controlButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#2c3e50',
    borderRadius: 8,
    marginRight: 8,
  },
  controlButtonText: { color: '#ffffff', fontWeight: '600' },
});
