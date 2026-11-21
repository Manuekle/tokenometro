import { describe, expect, it } from "vitest";
import { nextStickyTop, stickyBounds } from "./sticky";

const GAP = 20;

describe("stickyBounds", () => {
  it("is plain stick-to-the-top when the column fits the viewport", () => {
    expect(stickyBounds(900, 600, GAP)).toEqual({ min: 20, max: 20 });
    expect(stickyBounds(900, 860, GAP)).toEqual({ min: 20, max: 20 }); // exactly fits
  });

  it("lets a taller column rest with its bottom at the viewport's bottom", () => {
    // 900 - 1549 - 20: the top sits 669px above the viewport, the bottom 20px above its edge.
    expect(stickyBounds(900, 1549, GAP)).toEqual({ min: -669, max: 20 });
  });
});

describe("nextStickyTop", () => {
  const tall = stickyBounds(900, 1549, GAP);

  it("rides along with the page while scrolling down, then holds its bottom", () => {
    expect(nextStickyTop(20, 100, tall)).toBe(-80);
    expect(nextStickyTop(-80, 200, tall)).toBe(-280);
    expect(nextStickyTop(-280, 5_000, tall)).toBe(-669);
    expect(nextStickyTop(-669, 300, tall)).toBe(-669);
  });

  it("rides along with the page while scrolling up, then holds its top", () => {
    expect(nextStickyTop(-669, -100, tall)).toBe(-569);
    expect(nextStickyTop(-569, -5_000, tall)).toBe(20);
    expect(nextStickyTop(20, -300, tall)).toBe(20);
  });

  it("comes back to the same place after scrolling down and up by the same amount", () => {
    const down = nextStickyTop(-200, 150, tall);
    expect(nextStickyTop(down, -150, tall)).toBe(-200);
  });

  it("never moves when the column fits", () => {
    const fits = stickyBounds(900, 600, GAP);
    expect(nextStickyTop(20, 400, fits)).toBe(20);
    expect(nextStickyTop(20, -400, fits)).toBe(20);
  });

  it("reclamps a position that no longer fits after the column or the window changed size", () => {
    const shorter = stickyBounds(900, 700, GAP);
    expect(nextStickyTop(-500, 0, shorter)).toBe(20);
    const taller = stickyBounds(900, 2000, GAP);
    expect(nextStickyTop(20, 0, taller)).toBe(20);
    expect(nextStickyTop(-2000, 0, taller)).toBe(-1120);
  });
});
