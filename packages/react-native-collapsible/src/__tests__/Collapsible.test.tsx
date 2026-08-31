import * as React from 'react';
import {StyleSheet, Text} from 'react-native';
import {act, fireEvent, render} from '@testing-library/react-native';
import Collapsible from '../Collapsible';

describe('Collapsible', () => {
  it('renders expanded content immediately before the first measurement', () => {
    const view = render(
      <Collapsible testID="panel" collapsed={false}>
        <Text testID="body">Body</Text>
      </Collapsible>,
    );

    expect(view.getByTestId('body')).toBeTruthy();
    expect(view.getByTestId('panel').props.accessibilityElementsHidden).toBeUndefined();
  });

  it('hides fully collapsed content from interaction and accessibility', () => {
    const view = render(
      <Collapsible testID="panel">
        <Text>Body</Text>
      </Collapsible>,
    );
    const panel = view.getByTestId('panel', {includeHiddenElements: true});

    expect(panel.props.pointerEvents).toBe('none');
    expect(panel.props.accessibilityElementsHidden).toBe(true);
    expect(panel.props.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('measures before opening when collapsed children are unmounted', () => {
    const view = render(
      <Collapsible testID="panel" collapsed renderChildrenCollapsed={false} duration={0}>
        <Text testID="body">Body</Text>
      </Collapsible>,
    );

    expect(view.queryByTestId('body')).toBeNull();
    view.rerender(
      <Collapsible testID="panel" collapsed={false} renderChildrenCollapsed={false} duration={0}>
        <Text testID="body">Body</Text>
      </Collapsible>,
    );
    fireEvent(view.getByTestId('panel-content', {includeHiddenElements: true}), 'layout', {
      nativeEvent: {layout: {x: 0, y: 0, width: 100, height: 80}},
    });

    expect(view.getByTestId('body')).toBeTruthy();
    expect(view.getByTestId('panel').props.pointerEvents).toBeUndefined();
  });

  it('reports completed controlled transitions', () => {
    const onAnimationEnd = jest.fn();
    const view = render(
      <Collapsible testID="panel" collapsed duration={0} onAnimationEnd={onAnimationEnd}>
        <Text>Body</Text>
      </Collapsible>,
    );
    fireEvent(view.getByTestId('panel-content', {includeHiddenElements: true}), 'layout', {
      nativeEvent: {layout: {x: 0, y: 0, width: 100, height: 64}},
    });

    act(() => {
      view.rerender(
        <Collapsible testID="panel" collapsed={false} duration={0} onAnimationEnd={onAnimationEnd}>
          <Text>Body</Text>
        </Collapsible>,
      );
    });

    expect(onAnimationEnd).toHaveBeenCalledTimes(1);
  });

  it('preserves the measured content height across constrained collapsed layouts', () => {
    const view = render(
      <Collapsible testID="panel" collapsed={false} duration={0}>
        <Text>Body</Text>
      </Collapsible>,
    );
    const content = view.getByTestId('panel-content', {includeHiddenElements: true});

    fireEvent(content, 'layout', {
      nativeEvent: {layout: {x: 0, y: 0, width: 100, height: 80}},
    });
    view.rerender(
      <Collapsible testID="panel" collapsed duration={0}>
        <Text>Body</Text>
      </Collapsible>,
    );
    fireEvent(content, 'layout', {
      nativeEvent: {layout: {x: 0, y: 0, width: 100, height: 0}},
    });
    view.rerender(
      <Collapsible testID="panel" collapsed={false} duration={0}>
        <Text>Body</Text>
      </Collapsible>,
    );

    const style = StyleSheet.flatten(view.getByTestId('panel').props.style);
    const height = style.height as number | {__getValue: () => number};
    expect(typeof height === 'number' ? height : height.__getValue()).toBe(80);
  });
});
