import * as React from 'react';
import {
  Bar,
  Circle,
  CircleSnail,
  Pie,
  DEFAULT_COLOR,
} from '@ruban-labs/react-native-progress';

export function Sample(): React.ReactElement {
  return (
    <>
      <Bar progress={0.5} width={200} color="#ff0000" animationType="timing" />
      <Bar indeterminate useNativeDriver />
      <Circle
        progress={0.75}
        showsText
        size={60}
        thickness={5}
        formatText={(value) => `${Math.round(value * 100)}%`}
        strokeCap="round"
        endAngle={0.9}
        segmentCount={32}
        direction="counter-clockwise"
        fill="#ffffff"
        unfilledColor="#eeeeee"
      />
      <Circle indeterminate />
      <Pie progress={0.3} unfilledColor="#eeeeee" borderWidth={2} />
      <Pie indeterminate direction="counter-clockwise" />
      <CircleSnail
        color={['#ff0000', '#00ff00']}
        duration={900}
        spinDuration={4000}
        hidesWhenStopped
        animating
      />
      <Bar>{DEFAULT_COLOR}</Bar>
    </>
  );
}
