import {
  darkColors,
  lightColors,
  radius,
  rubanSemanticColors,
  rubanThemeColors,
  spacing,
} from '../index';

describe('theme exports', () => {
  it('keeps semantic roles complete in both modes', () => {
    expect(Object.keys(rubanSemanticColors.light)).toEqual(
      Object.keys(rubanSemanticColors.dark),
    );
    expect(Object.keys(rubanThemeColors.light)).toEqual(
      Object.keys(rubanThemeColors.dark),
    );
  });

  it('exposes distinct light and dark application colors', () => {
    expect(lightColors.mode).toBe('light');
    expect(darkColors.mode).toBe('dark');
    expect(lightColors.canvas).not.toBe(darkColors.canvas);
    expect(spacing.md).toBeGreaterThan(spacing.sm);
    expect(radius.pill).toBeGreaterThan(radius.md);
  });
});
