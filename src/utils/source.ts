import { Image, type ImageSourcePropType } from 'react-native';

import type { Size } from '../core/types';

export type CropSource = ImageSourcePropType | string;

/** Normalize the `source` prop to something RN's <Image> accepts. */
export function toImageSource(source: CropSource): ImageSourcePropType {
  return typeof source === 'string' ? { uri: source } : source;
}

/** Best-effort extraction of a uri (what extraction backends consume). */
export function resolveSourceUri(source: CropSource): string | undefined {
  if (typeof source === 'string') return source;
  if (typeof source === 'number') {
    const resolve = (Image as unknown as {
      resolveAssetSource?: (s: number) => { uri?: string } | undefined;
    }).resolveAssetSource;
    return resolve ? resolve(source)?.uri : undefined;
  }
  if (Array.isArray(source)) return source[0]?.uri;
  return (source as { uri?: string }).uri;
}

/**
 * Best-effort intrinsic-size detection. Explicit `imageSize` props always win —
 * this is the fallback for plain uri/module sources.
 */
export async function resolveImageSize(source: CropSource): Promise<Size> {
  if (typeof source === 'number') {
    const resolve = (Image as unknown as {
      resolveAssetSource?: (s: number) => { width?: number; height?: number } | undefined;
    }).resolveAssetSource;
    const asset = resolve?.(source);
    if (asset?.width && asset?.height) return { width: asset.width, height: asset.height };
    throw new Error('Could not resolve module asset size; pass imageSize explicitly.');
  }
  const uri = resolveSourceUri(source);
  if (!uri) throw new Error('Source has no uri; pass imageSize explicitly.');
  return new Promise<Size>((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      (err) => reject(err instanceof Error ? err : new Error(String(err))),
    );
  });
}
