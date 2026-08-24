import React from 'react';
import { render } from '@testing-library/react-native';
import { Bar } from '../Bar';
import { hostChild, hostChildren } from './testUtils';

describe('Bar', () => {
  it('renders with defaults', () => {
    const { getByTestId } = render(<Bar testID="bar" />);
    const bar = getByTestId('bar');
    expect(bar.props.style[0]).toMatchObject({
      width: 150,
      borderRadius: 4,
      borderWidth: 1,
      overflow: 'hidden',
    });
  });

  it('applies custom geometry and colors', () => {
    const { toJSON } = render(
      <Bar
        width={200}
        height={10}
        color="#ff0000"
        unfilledColor="#eeeeee"
        borderRadius={8}
        progress={0.5}
        animated={false}
      />
    );
    const root = toJSON();
    expect(Array.isArray(root)).toBe(false);
    const container = root as Exclude<ReturnType<typeof toJSON>, null | unknown[]>;
    expect(container.props.style[0]).toMatchObject({
      width: 200,
      borderRadius: 8,
      backgroundColor: '#eeeeee',
    });
    const fill = hostChild(container);
    expect(fill.props.style.backgroundColor).toBe('#ff0000');
    expect(fill.props.style.height).toBe(10);
  });

  it('renders indeterminate mode', () => {
    const { getByTestId, unmount } = render(<Bar testID="bar" indeterminate />);
    expect(getByTestId('bar')).toBeTruthy();
    expect(() => unmount()).not.toThrow();
  });

  it('renders children above the fill', () => {
    const { toJSON } = render(<Bar>label</Bar>);
    const container = toJSON();
    expect(hostChildren(container as never)).toContain('label');
  });
});
