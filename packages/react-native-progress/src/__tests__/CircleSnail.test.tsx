import React from 'react';
import { render } from '@testing-library/react-native';
import { CircleSnail } from '../CircleSnail';
import { hostChild, hostChildren } from './testUtils';

describe('CircleSnail', () => {
  it('renders a segmented ring', () => {
    const { toJSON } = render(<CircleSnail segmentCount={24} />);
    const rotationLayer = hostChild(toJSON());
    expect(hostChildren(rotationLayer).length).toBe(24);
  });

  it('hides when stopped with hidesWhenStopped', () => {
    const { queryByTestId } = render(
      <CircleSnail testID="snail" animating={false} hidesWhenStopped />
    );
    expect(queryByTestId('snail')).toBeNull();
  });

  it('stays visible when stopped without hidesWhenStopped', () => {
    const { getByTestId } = render(
      <CircleSnail testID="snail" animating={false} />
    );
    expect(getByTestId('snail')).toBeTruthy();
  });

  it('accepts a color list', () => {
    const { getByTestId } = render(
      <CircleSnail testID="snail" color={['#f00', '#0f0', '#00f']} />
    );
    expect(getByTestId('snail')).toBeTruthy();
  });
});
