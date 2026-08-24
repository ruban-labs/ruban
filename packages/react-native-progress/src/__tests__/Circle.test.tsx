import React from 'react';
import { render } from '@testing-library/react-native';
import { Circle } from '../Circle';
import { collectStyled, hostChild, hostChildren } from './testUtils';

describe('Circle', () => {
  it('renders centered percentage text when showsText is set', () => {
    const { getByText } = render(
      <Circle progress={0.5} showsText animated={false} />
    );
    expect(getByText('50%')).toBeTruthy();
  });

  it('uses a custom formatText', () => {
    const { getByText } = render(
      <Circle
        progress={0.25}
        showsText
        animated={false}
        formatText={(value) => `${value}/1`}
      />
    );
    expect(getByText('0.25/1')).toBeTruthy();
  });

  it('renders the requested number of segments', () => {
    const { toJSON } = render(
      <Circle segmentCount={20} animated={false} progress={0.5} borderWidth={0} />
    );
    const container = toJSON();
    const rotationLayer = hostChild(container);
    const segmentRing = hostChild(rotationLayer);
    expect(hostChildren(segmentRing).length).toBe(20);
  });

  it('lights segments according to progress', () => {
    const { toJSON } = render(
      <Circle
        segmentCount={20}
        animated={false}
        progress={0.5}
        color="#00ff00"
        borderWidth={0}
      />
    );
    const container = toJSON();
    const lit = collectStyled(container as never, (style) =>
      Boolean(style && (style as { backgroundColor?: string }).backgroundColor === '#00ff00')
    );
    expect(lit.length).toBe(10);
  });

  it('clamps out-of-range progress', () => {
    const { getByText } = render(
      <Circle progress={1.7} showsText animated={false} />
    );
    expect(getByText('100%')).toBeTruthy();
  });

  it('renders indeterminate without text', () => {
    const { queryByText, getByTestId } = render(
      <Circle testID="ring" indeterminate showsText />
    );
    expect(getByTestId('ring')).toBeTruthy();
    expect(queryByText('90%')).toBeNull();
  });

  it('shows a gap in indeterminate mode per endAngle', () => {
    const { toJSON } = render(
      <Circle segmentCount={20} indeterminate endAngle={0.5} borderWidth={0} />
    );
    const rotationLayer = hostChild(toJSON());
    const segmentRing = hostChild(rotationLayer);
    const visible = hostChildren(segmentRing).filter(
      (segment) => segment.props.style.backgroundColor !== 'transparent'
    );
    expect(visible.length).toBe(10);
  });
});
