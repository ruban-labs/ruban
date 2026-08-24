import React from 'react';
import { render } from '@testing-library/react-native';
import { Pie } from '../Pie';
import { hostChild, hostChildren } from './testUtils';

describe('Pie', () => {
  it('renders container with the requested size', () => {
    const { getByTestId } = render(<Pie testID="pie" size={60} progress={0.4} />);
    const pie = getByTestId('pie');
    expect(pie.props.style[0]).toMatchObject({ width: 60, height: 60 });
  });

  it('renders the unfilled base disk when unfilledColor is set', () => {
    const { toJSON } = render(
      <Pie unfilledColor="#eeeeee" progress={0.1} animated={false} />
    );
    const rotationLayer = hostChild(toJSON());
    const base = hostChild(rotationLayer);
    expect(base.props.style.backgroundColor).toBe('#eeeeee');
  });

  it('omits the base disk without unfilledColor', () => {
    const { toJSON } = render(<Pie progress={0.1} animated={false} />);
    const rotationLayer = hostChild(toJSON());
    const first = hostChild(rotationLayer);
    expect(first.props.style.backgroundColor).toBeUndefined();
  });

  it('renders children above the pie', () => {
    const { toJSON } = render(<Pie>center</Pie>);
    expect(hostChildren(toJSON())).toContain('center');
  });
});
