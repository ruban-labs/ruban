/** iOS system blue - the original default, kept for drop-in familiarity. */
export const DEFAULT_COLOR = 'rgba(0, 122, 255, 1)';

/** Width of the traveling segment in indeterminate Bar mode. */
export const INDETERMINATE_WIDTH_FACTOR = 0.3;

/**
 * Starting position of the traveling segment so it begins fully outside the
 * visible track (mirrors the original implementation).
 */
export const BAR_WIDTH_ZERO_POSITION =
  INDETERMINATE_WIDTH_FACTOR / (1 + INDETERMINATE_WIDTH_FACTOR);

export const clampProgress = (value: number): number =>
  Math.min(Math.max(Number.isFinite(value) ? value : 0, 0), 1);
