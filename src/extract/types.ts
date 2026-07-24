import type { CropRegion } from '../core/types';

export type CropFormat = 'jpeg' | 'png' | 'webp';

export interface CropOptions {
  /** Output encoding. Default 'jpeg'. */
  format?: CropFormat;
  /** 0..1, for lossy formats. Default 0.9. */
  quality?: number;
  /**
   * Optional output resize (aspect ratio is the crop rect's; give one dimension and
   * the other is derived, give both to force). Applied after cropping.
   */
  resize?: { width?: number; height?: number };
  /** Web only: also return a base64 data URL instead of an object URL. */
  output?: 'object-url' | 'data-url';
}

export interface CropResult {
  /**
   * URI of the produced image (file:// on native, object/data URL on web).
   * Web note: object URLs are never revoked by the library — call
   * `URL.revokeObjectURL(uri)` when done to avoid accumulating blobs.
   */
  uri: string;
  width: number;
  height: number;
  /** Present on web. */
  blob?: Blob;
  /** Present when the backend produced base64 (web 'data-url', expo base64). */
  base64?: string;
  /**
   * Actual encoded MIME type when the backend reports one (web). Browsers fall
   * back to image/png when they can't encode the requested format (e.g. webp on
   * Safari) — check this instead of assuming the requested format.
   */
  mimeType?: string;
}

/**
 * A pluggable extraction engine. Backends receive the fully-resolved instruction —
 * "rotate by `region.rotationDeg`, then cut `region.rect` out of the rotated canvas"
 * — so they contain zero cropper logic.
 */
export interface CropBackend {
  name: string;
  capabilities: {
    /** Whether the backend can execute region.rotationDeg !== 0. */
    rotation: boolean;
  };
  crop(sourceUri: string, region: CropRegion, options?: CropOptions): Promise<CropResult>;
}

export type CropPickerErrorCode =
  | 'NO_BACKEND'
  | 'ROTATION_UNSUPPORTED'
  | 'IMAGE_LOAD_FAILED'
  | 'ENCODE_FAILED'
  | 'NOT_READY';

export class CropPickerError extends Error {
  readonly code: CropPickerErrorCode;

  constructor(code: CropPickerErrorCode, message: string) {
    super(message);
    this.name = 'CropPickerError';
    this.code = code;
  }
}

/** Derive final output dimensions from the crop rect + resize option. */
export function resolveOutputSize(
  rectWidth: number,
  rectHeight: number,
  resize?: { width?: number; height?: number },
): { width: number; height: number } {
  if (!resize || (resize.width == null && resize.height == null)) {
    return { width: rectWidth, height: rectHeight };
  }
  const { width, height } = resize;
  if (width != null && height != null) return { width, height };
  if (width != null) return { width, height: Math.round((width * rectHeight) / rectWidth) };
  return {
    width: Math.round(((height as number) * rectWidth) / rectHeight),
    height: height as number,
  };
}
