import type { CropBackend, CropOptions, CropResult } from './types';
import { resolveOutputSize } from './types';
import type { CropRegion } from '../core/types';

/**
 * Structural type for the `expo-image-manipulator` module, passed IN by the
 * consumer, never imported here (keeps Metro from trying to resolve an optional
 * dependency at bundle time).
 */
export interface ExpoImageManipulatorLike {
  manipulateAsync(
    uri: string,
    actions: Array<
      | { rotate: number }
      | { crop: { originX: number; originY: number; width: number; height: number } }
      | { resize: { width?: number; height?: number } }
    >,
    saveOptions?: {
      compress?: number;
      format?: unknown;
      base64?: boolean;
    },
  ): Promise<{ uri: string; width: number; height: number; base64?: string }>;
  SaveFormat?: Record<string, unknown>;
}

export interface ExpoBackendOptions {
  /**
   * Set true if your expo-image-manipulator version rotates counter-clockwise for
   * positive degrees (the library's regions are CLOCKWISE degrees). Verified default
   * behavior is clockwise; flip this if your rotated crops come out mirrored 90°.
   */
  counterClockwise?: boolean;
  /** Ask the backend to also return base64. */
  base64?: boolean;
}

/**
 * Extraction backend for Expo apps:
 *
 *   import * as ImageManipulator from 'expo-image-manipulator';
 *   setCropBackend(createExpoImageManipulatorBackend(ImageManipulator));
 */
export function createExpoImageManipulatorBackend(
  manipulator: ExpoImageManipulatorLike,
  backendOptions: ExpoBackendOptions = {},
): CropBackend {
  return {
    name: 'expo-image-manipulator',
    capabilities: { rotation: true },
    async crop(
      sourceUri: string,
      region: CropRegion,
      options: CropOptions = {},
    ): Promise<CropResult> {
      const { rect, rotationDeg } = region;
      const actions: Parameters<ExpoImageManipulatorLike['manipulateAsync']>[1] = [];
      if (rotationDeg !== 0) {
        actions.push({
          rotate: backendOptions.counterClockwise ? 360 - rotationDeg : rotationDeg,
        });
      }
      actions.push({
        crop: { originX: rect.x, originY: rect.y, width: rect.width, height: rect.height },
      });
      const out = resolveOutputSize(rect.width, rect.height, options.resize);
      if (out.width !== rect.width || out.height !== rect.height) {
        actions.push({ resize: { width: out.width, height: out.height } });
      }

      const format = options.format ?? 'jpeg';
      const saveFormat = manipulator.SaveFormat?.[format.toUpperCase()] ?? format;
      const result = await manipulator.manipulateAsync(sourceUri, actions, {
        compress: options.quality ?? 0.9,
        format: saveFormat,
        base64: backendOptions.base64,
      });
      return {
        uri: result.uri,
        width: result.width,
        height: result.height,
        base64: result.base64,
      };
    },
  };
}
