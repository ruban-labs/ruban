import * as lib from '../index';

describe('public exports', () => {
  it('exports all components', () => {
    expect(lib.Bar).toBeDefined();
    expect(lib.Circle).toBeDefined();
    expect(lib.CircleSnail).toBeDefined();
    expect(lib.Pie).toBeDefined();
  });

  it('exports the default color constant', () => {
    expect(lib.DEFAULT_COLOR).toBe('rgba(0, 122, 255, 1)');
  });
});
