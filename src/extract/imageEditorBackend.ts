import type { CropBackend, CropOptions, CropResult } from './types';
import { CropPickerError, resolveOutputSize } from './types';
import type { CropRegion } from '../core/types';

/**
 * Structural type for `@react-native-community/image-editor` — passed IN by the
 * consumer, never imported here. v4 resolves an object; v3 resolved a bare uri
 * string; both are handled.
 */
export interface ImageEditorLike {
  cropImage(
    uri: string,
    cropData: {
      offset: { x: number; y: number };
      size: { width: number; height: number };
      displaySize?: { width: number; height: number };
      quality?: number;
      format?: string;
    },
  ): Promise<string | { uri: string; width?: number; height?: number }>;
}

/**
 * Extraction backend for bare React Native apps using
 * `@react-native-community/image-editor`. NOTE: that module cannot rotate, so this
 * backend only executes regions with rotationDeg === 0 — disable rotation on the
 * component (default) or use the Expo backend when you need rotated crops.
 */
export function createImageEditorBackend(imageEditor: ImageEditorLike): CropBackend {
  return {
    name: 'image-editor',
    capabilities: { rotation: false },
    async crop(
      sourceUri: string,
      region: CropRegion,
      options: CropOptions = {},
    ): Promise<CropResult> {
      if (region.rotationDeg !== 0) {
        throw new CropPickerError(
          'ROTATION_UNSUPPORTED',
          '@react-native-community/image-editor cannot rotate; use the Expo backend or keep rotation disabled.',
        );
      }
      const { rect } = region;
      const out = resolveOutputSize(rect.width, rect.height, options.resize);
      const result = await imageEditor.cropImage(sourceUri, {
        offset: { x: rect.x, y: rect.y },
        size: { width: rect.width, height: rect.height },
        displaySize: out.width !== rect.width || out.height !== rect.height ? out : undefined,
        quality: options.quality ?? 0.9,
        format: options.format ?? 'jpeg',
      });
      if (typeof result === 'string') {
        return { uri: result, width: out.width, height: out.height };
      }
      return {
        uri: result.uri,
        width: result.width ?? out.width,
        height: result.height ?? out.height,
      };
    },
  };
}
