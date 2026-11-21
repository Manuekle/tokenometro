/**
 * A sticky column taller than the screen cannot just stick to the top of the
 * viewport: its bottom half would be out of reach. So it follows the page until
 * one of its edges meets the viewport and holds there: its bottom while you
 * scroll down, its top while you scroll up. Nothing about its look changes.
 *
 * Both helpers deal in the CSS `top` of a `position: sticky` element.
 */
export interface StickyBounds {
  /** Resting `top` when the column is taller than the viewport and you scroll down (negative). */
  min: number;
  /** Resting `top` when you scroll up: `gap` below the viewport's top edge. */
  max: number;
}

export function stickyBounds(viewportHeight: number, columnHeight: number, gap: number): StickyBounds {
  // Short enough to fit: min equals max and this is plain "stick to the top".
  return { min: Math.min(gap, viewportHeight - columnHeight - gap), max: gap };
}

/**
 * The `top` after the page scrolled `dy` pixels (positive = down). Moving `top`
 * by exactly what the page moved makes the column ride along with the content
 * until it reaches `min` or `max`, so there is never a jump.
 */
export function nextStickyTop(top: number, dy: number, { min, max }: StickyBounds): number {
  return Math.min(max, Math.max(min, top - dy));
}
