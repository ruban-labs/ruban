import * as React from 'react';
import {Text} from 'react-native';
import {fireEvent, render} from '@testing-library/react-native';
import Accordion from '../Accordion';

const sections = [
  {id: 'one', title: 'One'},
  {id: 'two', title: 'Two'},
];

function renderHeader(section: (typeof sections)[number]): React.ReactNode {
  return <Text>{section.title}</Text>;
}

function renderContent(section: (typeof sections)[number]): React.ReactNode {
  return <Text>{section.id}</Text>;
}

describe('Accordion', () => {
  it('opens one section in single mode', () => {
    const onChange = jest.fn();
    const view = render(
      <Accordion
        testID="accordion"
        sections={sections}
        activeSections={[0]}
        onChange={onChange}
        renderHeader={renderHeader}
        renderContent={renderContent}
      />,
    );

    fireEvent.press(view.getByTestId('accordion-header-1'));
    expect(onChange).toHaveBeenCalledWith([1]);
    expect(view.getByTestId('accordion-header-0').props.accessibilityState.expanded).toBe(true);
  });

  it('preserves active sections in multiple mode', () => {
    const onChange = jest.fn();
    const view = render(
      <Accordion
        testID="accordion"
        sections={sections}
        activeSections={[0]}
        expandMultiple
        onChange={onChange}
        renderHeader={renderHeader}
        renderContent={renderContent}
      />,
    );

    fireEvent.press(view.getByTestId('accordion-header-1'));
    expect(onChange).toHaveBeenCalledWith([0, 1]);
  });

  it('does not toggle disabled sections', () => {
    const onChange = jest.fn();
    const view = render(
      <Accordion
        testID="accordion"
        sections={sections}
        activeSections={[]}
        disabled={(_, index) => index === 1}
        onChange={onChange}
        renderHeader={renderHeader}
        renderContent={renderContent}
      />,
    );

    fireEvent.press(view.getByTestId('accordion-header-1'));
    expect(onChange).not.toHaveBeenCalled();
    expect(view.getByTestId('accordion-header-1').props.accessibilityState.disabled).toBe(true);
  });
});
