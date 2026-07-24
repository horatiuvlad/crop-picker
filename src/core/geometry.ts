import type { CropGeometry, CropRegion, CropTransform, Point, Size } from './types';

/**
 * Pure geometry for a fixed-window cropper (image pans/zooms/rotates UNDER a static
 * crop window). Zero dependencies, no platform APIs.
 *
 * Every function carries the `'worklet'` directive so the exact same code runs on
 * Reanimated's UI thread; outside Reanimated the directive is an inert string, so
 * these stay ordinary, unit-testable functions.
 *
 * See {@link CropTransform} for the coordinate model. The invariant every clamp
 * enforces: the window must always be fully covered by the image —
 * every window corner, mapped into image space, lies inside the bitmap.
 */

const DEG_PER_RAD = 180 / Math.PI;

export function radToDeg(rad: number): number {
  'worklet';
  return rad * DEG_PER_RAD;
}

export function degToRad(deg: number): number {
  'worklet';
  return deg / DEG_PER_RAD;
}

/** Normalize degrees into [0, 360). */
export function normalizeDeg(deg: number): number {
  'worklet';
  const d = deg % 360;
  return d < 0 ? d + 360 : d;
}

/**
 * Minimal scale at which the image (rotated by `rotation`) fully covers the window.
 *
 * Derivation: window corners mapped to image space are R(-θ)·c / s. The spread of
 * R(-θ)·c across window corners is W|cosθ|+H|sinθ| horizontally and
 * W|sinθ|+H|cosθ| vertically; covering requires that spread ≤ s·(image dim).
 */
export function coverScale(geometry: CropGeometry, rotation: number): number {
  'worklet';
  const { imageSize, windowSize } = geometry;
  const c = Math.abs(Math.cos(rotation));
  const s = Math.abs(Math.sin(rotation));
  const needW = windowSize.width * c + windowSize.height * s;
  const needH = windowSize.width * s + windowSize.height * c;
  return Math.max(needW / imageSize.width, needH / imageSize.height);
}

/**
 * Current zoom, defined relative to the cover scale at the current rotation:
 * zoom 1 = image exactly covers the window.
 */
export function zoomOf(scale: number, rotation: number, geometry: CropGeometry): number {
  'worklet';
  return scale / coverScale(geometry, rotation);
}

/** Clamp scale into [cover, max(cover, coverAt0 · maxZoom)]. */
export function clampScale(
  scale: number,
  rotation: number,
  geometry: CropGeometry,
  maxZoom: number,
): number {
  'worklet';
  const min = coverScale(geometry, rotation);
  const max = Math.max(min, coverScale(geometry, 0) * maxZoom);
  return Math.min(Math.max(scale, min), max);
}

/**
 * Clamp the translation so the (scaled, rotated) image still covers the window.
 *
 * Working in u = R(-θ)·t: each window corner c must satisfy
 * R(-θ)(c - t)/s ∈ image box, i.e. u ∈ [±(s·w/2 - spreadX)] × [±(s·h/2 - spreadY)],
 * where spread is the half-extent of R(-θ)·corners. Clamp u per axis, rotate back.
 */
export function clampTranslation(
  translateX: number,
  translateY: number,
  scale: number,
  rotation: number,
  geometry: CropGeometry,
): Point {
  'worklet';
  const { imageSize, windowSize } = geometry;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const halfSpreadX =
    (windowSize.width * Math.abs(cos) + windowSize.height * Math.abs(sin)) / 2;
  const halfSpreadY =
    (windowSize.width * Math.abs(sin) + windowSize.height * Math.abs(cos)) / 2;

  const slackX = Math.max(0, (scale * imageSize.width) / 2 - halfSpreadX);
  const slackY = Math.max(0, (scale * imageSize.height) / 2 - halfSpreadY);

  // u = R(-θ) · t   (R(-θ) for clockwise-positive θ in y-down coords)
  const ux = cos * translateX + sin * translateY;
  const uy = -sin * translateX + cos * translateY;

  const cx = Math.min(Math.max(ux, -slackX), slackX);
  const cy = Math.min(Math.max(uy, -slackY), slackY);

  // back: t = R(θ) · u
  return { x: cos * cx - sin * cy, y: sin * cx + cos * cy };
}

/**
 * The legal translation range as an AXIS-ALIGNED box in translation space, or null
 * when no such box exists.
 *
 * The legal region is always a box in the ROTATED frame u = R(-θ)·t; it is a box in
 * t-space too exactly when θ is a multiple of 90° (R then maps axes onto axes,
 * swapping them at 90°/270°). That is precisely the case where a per-axis animation
 * (e.g. Reanimated's `withDecay` clamp) is exact — which is what fling uses. For
 * free angles this returns null and callers fall back to {@link clampTranslation}.
 */
export function translationBounds(
  scale: number,
  rotation: number,
  geometry: CropGeometry,
  toleranceDeg = 0.01,
): { minX: number; maxX: number; minY: number; maxY: number } | null {
  'worklet';
  const deg = radToDeg(rotation);
  const step = Math.round(deg / 90);
  if (Math.abs(deg - step * 90) > toleranceDeg) return null;

  const { imageSize, windowSize } = geometry;
  const quarterTurned = Math.abs(step % 2) === 1; // 90° or 270°
  // Half-extents of the window in the rotated frame.
  const halfSpreadX = (quarterTurned ? windowSize.height : windowSize.width) / 2;
  const halfSpreadY = (quarterTurned ? windowSize.width : windowSize.height) / 2;
  const slackX = Math.max(0, (scale * imageSize.width) / 2 - halfSpreadX);
  const slackY = Math.max(0, (scale * imageSize.height) / 2 - halfSpreadY);
  // t = R(θ)·u swaps the axes on a quarter turn.
  const boundX = quarterTurned ? slackY : slackX;
  const boundY = quarterTurned ? slackX : slackY;
  return { minX: -boundX, maxX: boundX, minY: -boundY, maxY: boundY };
}

/**
 * Apply a pinch: rescale by `factor` about the window-space focal point, keeping the
 * image point under the focal point stationary: t' = f + factor · (t - f).
 */
export function applyPinch(
  transform: CropTransform,
  factor: number,
  focal: Point,
): CropTransform {
  'worklet';
  return {
    translateX: focal.x + factor * (transform.translateX - focal.x),
    translateY: focal.y + factor * (transform.translateY - focal.y),
    scale: transform.scale * factor,
    rotation: transform.rotation,
  };
}

/**
 * Apply a rotation delta about the window-space focal point:
 * t' = f + R(Δ)(t - f), θ' = θ + Δ.
 */
export function applyRotation(
  transform: CropTransform,
  delta: number,
  focal: Point,
): CropTransform {
  'worklet';
  const cos = Math.cos(delta);
  const sin = Math.sin(delta);
  const dx = transform.translateX - focal.x;
  const dy = transform.translateY - focal.y;
  return {
    translateX: focal.x + cos * dx - sin * dy,
    translateY: focal.y + sin * dx + cos * dy,
    scale: transform.scale,
    rotation: transform.rotation + delta,
  };
}

/**
 * The legal resting state closest to `transform`: scale clamped to [cover, max],
 * then translation clamped so the window stays covered. This is the target the UI
 * springs to when a gesture ends.
 */
export function settleTransform(
  transform: CropTransform,
  geometry: CropGeometry,
  maxZoom: number,
): CropTransform {
  'worklet';
  const scale = clampScale(transform.scale, transform.rotation, geometry, maxZoom);
  // Rescale the translation about the window center (focal 0,0) so the visual
  // composition is preserved as closely as possible when the scale snaps back.
  const factor = scale / transform.scale;
  const t = clampTranslation(
    transform.translateX * factor,
    transform.translateY * factor,
    scale,
    transform.rotation,
    geometry,
  );
  return { translateX: t.x, translateY: t.y, scale, rotation: transform.rotation };
}

/** The identity/reset state: zoom 1 (exact cover), centered, at the given rotation. */
export function initialTransform(geometry: CropGeometry, rotation = 0): CropTransform {
  'worklet';
  return { translateX: 0, translateY: 0, scale: coverScale(geometry, rotation), rotation };
}

/** Bounding-box size of the image after rotating by `rotation` about its center. */
export function rotatedCanvasSize(imageSize: Size, rotation: number): Size {
  'worklet';
  const c = Math.abs(Math.cos(rotation));
  const s = Math.abs(Math.sin(rotation));
  return {
    width: imageSize.width * c + imageSize.height * s,
    height: imageSize.width * s + imageSize.height * c,
  };
}

/**
 * Resolve the current view-state into an executable {@link CropRegion}.
 *
 * Key fact (what makes extraction simple): screen space and rotated-canvas space
 * differ only by scale + offset — p_canvas = (p_screen - t)/s + canvasCenter — so the
 * axis-aligned window maps to an axis-aligned rect in the rotated canvas.
 *
 * Snapping: rotations within `snapEpsilonDeg` of a multiple of 90° are snapped, so
 * the overwhelmingly common cases (0/90/180/270) produce exact, rotation-free or
 * dimension-swapped crops instead of accumulating float noise.
 */
export function cropRegion(
  transform: CropTransform,
  geometry: CropGeometry,
  snapEpsilonDeg = 0.75,
): CropRegion {
  'worklet';
  let rotationDeg = normalizeDeg(radToDeg(transform.rotation));
  const nearest90 = Math.round(rotationDeg / 90) * 90;
  if (Math.abs(rotationDeg - nearest90) <= snapEpsilonDeg) {
    rotationDeg = normalizeDeg(nearest90);
  }
  const rotation = degToRad(rotationDeg);

  const { imageSize, windowSize } = geometry;
  const canvasFloat = rotatedCanvasSize(imageSize, rotation);
  // Exact 90° steps are dimension swaps (exact); free angles use FLOOR so the rect
  // can never overflow an extraction engine whose own rounding lands 1px smaller.
  const exact90 = rotationDeg % 90 === 0;
  const canvas: Size = exact90
    ? { width: Math.round(canvasFloat.width), height: Math.round(canvasFloat.height) }
    : { width: Math.floor(canvasFloat.width), height: Math.floor(canvasFloat.height) };

  const { scale, translateX, translateY } = transform;
  // p_canvas = (p_screen - t) / s + canvas/2 ; window corner = (-W/2, -H/2)
  let x = (-windowSize.width / 2 - translateX) / scale + canvasFloat.width / 2;
  let y = (-windowSize.height / 2 - translateY) / scale + canvasFloat.height / 2;
  let w = windowSize.width / scale;
  let h = windowSize.height / scale;

  // Integer-snap and clamp to the canvas (guards float dust at the edges).
  x = Math.round(x);
  y = Math.round(y);
  w = Math.round(w);
  h = Math.round(h);
  x = Math.min(Math.max(x, 0), Math.max(0, canvas.width - 1));
  y = Math.min(Math.max(y, 0), Math.max(0, canvas.height - 1));
  w = Math.max(1, Math.min(w, canvas.width - x));
  h = Math.max(1, Math.min(h, canvas.height - y));

  return { rotationDeg, canvasSize: canvas, rect: { x, y, width: w, height: h } };
}

/**
 * The transform that shows exactly `region` in the window again (inverse of
 * {@link cropRegion}, up to integer snapping) — lets callers restore a saved crop.
 */
export function transformForRegion(region: CropRegion, geometry: CropGeometry): CropTransform {
  'worklet';
  const rotation = degToRad(region.rotationDeg);
  const scale = geometry.windowSize.width / region.rect.width;
  const canvas = rotatedCanvasSize(geometry.imageSize, rotation);
  const translateX =
    -geometry.windowSize.width / 2 - (region.rect.x - canvas.width / 2) * scale;
  const translateY =
    -geometry.windowSize.height / 2 - (region.rect.y - canvas.height / 2) * scale;
  return { translateX, translateY, scale, rotation };
}

/** Map a window-space point to original-image pixel coordinates (origin top-left). */
export function windowPointToImagePoint(
  point: Point,
  transform: CropTransform,
  geometry: CropGeometry,
): Point {
  'worklet';
  const cos = Math.cos(transform.rotation);
  const sin = Math.sin(transform.rotation);
  const dx = point.x - transform.translateX;
  const dy = point.y - transform.translateY;
  // R(-θ)·d / s, then shift origin to the image's top-left corner
  return {
    x: (cos * dx + sin * dy) / transform.scale + geometry.imageSize.width / 2,
    y: (-sin * dx + cos * dy) / transform.scale + geometry.imageSize.height / 2,
  };
}
