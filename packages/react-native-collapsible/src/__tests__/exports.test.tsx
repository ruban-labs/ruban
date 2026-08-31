import Collapsible, {
  Accordion,
  Collapsible as NamedCollapsible,
} from '../index';

describe('exports', () => {
  it('exposes the primitive and accordion from the root', () => {
    expect(Collapsible).toBe(NamedCollapsible);
    expect(typeof Collapsible).toBe('function');
    expect(typeof Accordion).toBe('function');
  });
});
