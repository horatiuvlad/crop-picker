import { describe, expect, it } from 'vitest';

import {
  applyPinch,
  applyRotation,
  clampScale,
  clampTranslation,
  coverScale,
  cropRegion,
  degToRad,
  initialTransform,
  normalizeDeg,
  rotatedCanvasSize,
  settleTransform,
  transformForRegion,
  windowPointToImagePoint,
  zoomOf,
} from '../geometry';
import type { CropGeometry, CropTransform } from '../types';

const geo = (iw: number, ih: number, ww: number, wh: number): CropGeometry => ({
  imageSize: { width: iw, height: ih },
  windowSize: { width: ww, height: wh },
});

/** Deterministic PRNG so the property-style sweeps are reproducible. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The library's core invariant: every window corner maps inside the bitmap. */
function windowIsCovered(t: CropTransform, g: CropGeometry, tol = 1e-6): boolean {
  const { width: W, height: H } = g.windowSize;
  const corners = [
    { x: -W / 2, y: -H / 2 },
    { x: W / 2, y: -H / 2 },
    { x: -W / 2, y: H / 2 },
    { x: W / 2, y: H / 2 },
  ];
  return corners.every((c) => {
    const p = windowPointToImagePoint(c, t, g);
    return (
      p.x >= -tol &&
      p.y >= -tol &&
      p.x <= g.imageSize.width + tol &&
      p.y <= g.imageSize.height + tol
    );
  });
}

describe('coverScale', () => {
  it('is the max of per-axis ratios at rotation 0', () => {
    expect(coverScale(geo(2000, 1000, 100, 100), 0)).toBeCloseTo(0.1, 12);
    expect(coverScale(geo(2000, 1000, 300, 100), 0)).toBeCloseTo(0.15, 12);
  });

  it('swaps the window axes at 90°', () => {
    expect(coverScale(geo(2000, 1000, 300, 100), degToRad(90))).toBeCloseTo(0.3, 12);
  });

  it('matches the closed form at 45°', () => {
    const g = geo(1000, 800, 200, 100);
    const s = Math.SQRT1_2; // |cos 45| = |sin 45|
    const expected = Math.max((200 * s + 100 * s) / 1000, (200 * s + 100 * s) / 800);
    expect(coverScale(g, degToRad(45))).toBeCloseTo(expected, 12);
  });

  it('is periodic mod 180 and symmetric', () => {
    const g = geo(1234, 987, 210, 140);
    for (const deg of [0, 30, 60, 90, 145]) {
      expect(coverScale(g, degToRad(deg))).toBeCloseTo(coverScale(g, degToRad(deg + 180)), 10);
      expect(coverScale(g, degToRad(deg))).toBeCloseTo(coverScale(g, degToRad(-deg)), 10);
    }
  });
});

describe('clampTranslation', () => {
  it('limits panning to the slack at rotation 0', () => {
    const g = geo(1000, 1000, 100, 100);
    const s = 0.2; // displayed 200x200 → slack 50 per axis
    expect(clampTranslation(80, -80, s, 0, g)).toEqual({ x: 50, y: -50 });
    expect(clampTranslation(10, 20, s, 0, g)).toEqual({ x: 10, y: 20 });
  });

  it('returns 0 when the image exactly covers the window', () => {
    const g = geo(500, 500, 100, 100);
    const s = coverScale(g, 0);
    const t = clampTranslation(37, -12, s, 0, g);
    expect(t.x).toBeCloseTo(0, 9);
    expect(t.y).toBeCloseTo(0, 9);
  });

  it('keeps the window covered for random states and angles (brute force)', () => {
    const rand = mulberry32(42);
    for (let i = 0; i < 2500; i++) {
      const g = geo(
        200 + Math.floor(rand() * 3800),
        200 + Math.floor(rand() * 3800),
        50 + Math.floor(rand() * 300),
        50 + Math.floor(rand() * 300),
      );
      const rotation = (rand() * 4 - 2) * Math.PI;
      const scale = clampScale(coverScale(g, rotation) * (0.3 + rand() * 6), rotation, g, 12);
      const t = clampTranslation(
        (rand() - 0.5) * 4000,
        (rand() - 0.5) * 4000,
        scale,
        rotation,
        g,
      );
      const state: CropTransform = { translateX: t.x, translateY: t.y, scale, rotation };
      expect(windowIsCovered(state, g, 1e-6)).toBe(true);
    }
  });
});

describe('applyPinch', () => {
  it('keeps the image point under the focal point stationary', () => {
    const g = geo(3000, 2000, 300, 200);
    const rand = mulberry32(7);
    for (let i = 0; i < 500; i++) {
      const base: CropTransform = {
        translateX: (rand() - 0.5) * 200,
        translateY: (rand() - 0.5) * 200,
        scale: coverScale(g, 0) * (1 + rand() * 3),
        rotation: (rand() - 0.5) * 2,
      };
      const focal = { x: (rand() - 0.5) * 300, y: (rand() - 0.5) * 200 };
      const factor = 0.5 + rand() * 2;
      const next = applyPinch(base, factor, focal);
      const before = windowPointToImagePoint(focal, base, g);
      const after = windowPointToImagePoint(focal, next, g);
      expect(after.x).toBeCloseTo(before.x, 6);
      expect(after.y).toBeCloseTo(before.y, 6);
      expect(next.scale).toBeCloseTo(base.scale * factor, 9);
    }
  });
});

describe('applyRotation', () => {
  it('keeps the focal point stationary and accumulates rotation', () => {
    const g = geo(3000, 2000, 300, 200);
    const base: CropTransform = { translateX: 20, translateY: -14, scale: 0.4, rotation: 0.3 };
    const focal = { x: 40, y: -25 };
    const next = applyRotation(base, 0.5, focal);
    expect(next.rotation).toBeCloseTo(0.8, 12);
    const before = windowPointToImagePoint(focal, base, g);
    const after = windowPointToImagePoint(focal, next, g);
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
  });
});

describe('zoom semantics', () => {
  it('initialTransform is zoom 1, centered', () => {
    const g = geo(4000, 3000, 320, 180);
    const t = initialTransform(g);
    expect(zoomOf(t.scale, t.rotation, g)).toBeCloseTo(1, 12);
    expect(t.translateX).toBe(0);
    expect(t.translateY).toBe(0);
  });

  it('clampScale enforces [cover, cover0·maxZoom]', () => {
    const g = geo(1000, 1000, 100, 100);
    const cover = coverScale(g, 0);
    expect(clampScale(cover / 3, 0, g, 8)).toBeCloseTo(cover, 12);
    expect(clampScale(cover * 99, 0, g, 8)).toBeCloseTo(cover * 8, 12);
  });
});

describe('settleTransform', () => {
  it('produces a legal state from arbitrary junk', () => {
    const rand = mulberry32(1337);
    for (let i = 0; i < 800; i++) {
      const g = geo(
        300 + Math.floor(rand() * 3000),
        300 + Math.floor(rand() * 3000),
        60 + Math.floor(rand() * 240),
        60 + Math.floor(rand() * 240),
      );
      const junk: CropTransform = {
        translateX: (rand() - 0.5) * 5000,
        translateY: (rand() - 0.5) * 5000,
        scale: coverScale(g, 0) * (0.05 + rand() * 40),
        rotation: (rand() - 0.5) * 7,
      };
      const settled = settleTransform(junk, g, 8);
      expect(windowIsCovered(settled, g, 1e-6)).toBe(true);
      // maxZoom is an ABSOLUTE pixel-density cap anchored at the rotation-0 cover
      // scale (rotation-relative zoom may legitimately read higher when the rotated
      // cover scale is smaller than the upright one).
      expect(settled.scale).toBeLessThanOrEqual(coverScale(g, 0) * 8 * 1.0001);
      expect(settled.scale).toBeGreaterThanOrEqual(coverScale(g, settled.rotation) * 0.9999);
    }
  });
});

describe('rotatedCanvasSize', () => {
  it('is identity at 0 and swapped at 90°', () => {
    expect(rotatedCanvasSize({ width: 640, height: 480 }, 0)).toEqual({ width: 640, height: 480 });
    const r = rotatedCanvasSize({ width: 640, height: 480 }, degToRad(90));
    expect(r.width).toBeCloseTo(480, 9);
    expect(r.height).toBeCloseTo(640, 9);
  });
});

describe('cropRegion', () => {
  it('at rotation 0 the canvas is the image and the rect matches the visible window', () => {
    const g = geo(2000, 1000, 100, 100);
    const t = initialTransform(g); // scale 0.1 → window sees 1000x1000 centered
    const r = cropRegion(t, g);
    expect(r.rotationDeg).toBe(0);
    expect(r.canvasSize).toEqual({ width: 2000, height: 1000 });
    expect(r.rect).toEqual({ x: 500, y: 0, width: 1000, height: 1000 });
  });

  it('accounts for pan and zoom', () => {
    const g = geo(2000, 1000, 100, 100);
    const scale = 0.2; // window sees 500x500 of the image
    const t: CropTransform = { translateX: -30, translateY: 10, scale, rotation: 0 };
    const r = cropRegion(t, g);
    // x = (-50 - (-30))/0.2 + 1000 = -100 + 1000 = 900 ; y = (-50-10)/0.2 + 500 = 200
    expect(r.rect).toEqual({ x: 900, y: 200, width: 500, height: 500 });
  });

  it('snaps near-90 rotations and swaps the canvas', () => {
    const g = geo(2000, 1000, 100, 100);
    const t: CropTransform = {
      ...initialTransform(g, degToRad(89.8)),
      rotation: degToRad(89.8),
    };
    const r = cropRegion(t, g);
    expect(r.rotationDeg).toBe(90);
    expect(r.canvasSize.width).toBe(1000);
    expect(r.canvasSize.height).toBe(2000);
  });

  it('round-trips through transformForRegion', () => {
    const rand = mulberry32(99);
    for (let i = 0; i < 400; i++) {
      const g = geo(
        500 + Math.floor(rand() * 2500),
        500 + Math.floor(rand() * 2500),
        100 + Math.floor(rand() * 200),
        100 + Math.floor(rand() * 200),
      );
      const rotation = degToRad(Math.floor(rand() * 4) * 90);
      const scale = clampScale(coverScale(g, rotation) * (1 + rand() * 4), rotation, g, 8);
      const c = clampTranslation((rand() - 0.5) * 2000, (rand() - 0.5) * 2000, scale, rotation, g);
      const t: CropTransform = { translateX: c.x, translateY: c.y, scale, rotation };
      const region = cropRegion(t, g);
      const back = transformForRegion(region, g);
      const regionAgain = cropRegion(back, g);
      expect(regionAgain.rotationDeg).toBe(region.rotationDeg);
      // Integer snapping allows ±1px drift, no more.
      expect(Math.abs(regionAgain.rect.x - region.rect.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(regionAgain.rect.y - region.rect.y)).toBeLessThanOrEqual(1);
      expect(Math.abs(regionAgain.rect.width - region.rect.width)).toBeLessThanOrEqual(1);
      expect(Math.abs(regionAgain.rect.height - region.rect.height)).toBeLessThanOrEqual(1);
    }
  });

  it('always emits a rect inside the canvas', () => {
    const rand = mulberry32(2024);
    for (let i = 0; i < 800; i++) {
      const g = geo(
        300 + Math.floor(rand() * 3000),
        300 + Math.floor(rand() * 3000),
        80 + Math.floor(rand() * 200),
        80 + Math.floor(rand() * 200),
      );
      const junk: CropTransform = {
        translateX: (rand() - 0.5) * 3000,
        translateY: (rand() - 0.5) * 3000,
        scale: coverScale(g, 0) * (0.05 + rand() * 30),
        rotation: (rand() - 0.5) * 7,
      };
      const settled = settleTransform(junk, g, 10);
      const r = cropRegion(settled, g);
      expect(r.rect.x).toBeGreaterThanOrEqual(0);
      expect(r.rect.y).toBeGreaterThanOrEqual(0);
      expect(r.rect.x + r.rect.width).toBeLessThanOrEqual(r.canvasSize.width);
      expect(r.rect.y + r.rect.height).toBeLessThanOrEqual(r.canvasSize.height);
    }
  });
});

describe('normalizeDeg', () => {
  it('wraps into [0, 360)', () => {
    expect(normalizeDeg(0)).toBe(0);
    expect(normalizeDeg(370)).toBe(10);
    expect(normalizeDeg(-90)).toBe(270);
    expect(normalizeDeg(720)).toBe(0);
  });
});
