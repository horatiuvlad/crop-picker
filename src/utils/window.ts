import type { Size } from '../core/types';

/**
 * How the crop window is derived from the measured container. Every field
 * optional, everything computed responsively on layout:
 *  - `width`/`height`: request a fixed window (clamped into the container inset).
 *  - `aspect`: largest window of this aspect ratio that fits inside the inset
 *    container (default 1).
 *  - `inset`: minimum margin between window and container edges (default 24).
 */
export interface CropAreaSpec {
  aspect?: number;
  width?: number;
  height?: number;
  inset?: number;
}

export function computeWindowSize(
  container: Size,
  spec: CropAreaSpec = {},
  round = false,
): Size | null {
  const inset = spec.inset ?? 24;
  const availW = container.width - inset * 2;
  const availH = container.height - inset * 2;
  if (availW <= 0 || availH <= 0) return null;

  if (spec.width != null && spec.height != null && !round) {
    return {
      width: Math.min(spec.width, availW),
      height: Math.min(spec.height, availH),
    };
  }

  // A round window is necessarily 1:1.
  const aspect = round ? 1 : spec.aspect ?? (spec.width != null || spec.height != null
    ? undefined
    : 1);

  if (aspect == null) {
    // Single fixed dimension + free other dimension.
    const width = Math.min(spec.width ?? availW, availW);
    const height = Math.min(spec.height ?? availH, availH);
    return { width, height };
  }

  let width = availW;
  let height = width / aspect;
  if (height > availH) {
    height = availH;
    width = height * aspect;
  }
  if (spec.width != null) width = Math.min(width, spec.width);
  if (spec.height != null) height = Math.min(height, spec.height);
  if (round) {
    const d = Math.min(width, height);
    return { width: d, height: d };
  }
  return { width, height };
}
