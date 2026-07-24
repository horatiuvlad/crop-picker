import { describe, expect, it } from 'vitest';

import { resolveOutputSize } from '../../extract/types';
import { computeWindowSize } from '../../utils/window';

describe('computeWindowSize', () => {
  it('fits the largest square with default spec', () => {
    expect(computeWindowSize({ width: 400, height: 800 })).toEqual({ width: 352, height: 352 });
  });

  it('honors aspect against the limiting axis', () => {
    const w = computeWindowSize({ width: 1000, height: 300 }, { aspect: 16 / 9, inset: 10 });
    expect(w).not.toBeNull();
    expect(w!.height).toBeCloseTo(280, 6);
    expect(w!.width).toBeCloseTo(280 * (16 / 9), 6);
  });

  it('clamps fixed sizes into the container', () => {
    expect(
      computeWindowSize({ width: 300, height: 300 }, { width: 500, height: 100, inset: 20 }),
    ).toEqual({ width: 260, height: 100 });
  });

  it('forces a square for round windows', () => {
    const w = computeWindowSize({ width: 500, height: 300 }, { aspect: 2 }, true);
    expect(w).toEqual({ width: 252, height: 252 });
  });

  it('returns null when the container cannot host a window', () => {
    expect(computeWindowSize({ width: 30, height: 500 })).toBeNull();
  });
});

describe('resolveOutputSize', () => {
  it('defaults to the rect size', () => {
    expect(resolveOutputSize(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it('derives the missing dimension', () => {
    expect(resolveOutputSize(800, 600, { width: 400 })).toEqual({ width: 400, height: 300 });
    expect(resolveOutputSize(800, 600, { height: 300 })).toEqual({ width: 400, height: 300 });
  });

  it('forces both when both are given', () => {
    expect(resolveOutputSize(800, 600, { width: 100, height: 100 })).toEqual({
      width: 100,
      height: 100,
    });
  });
});
