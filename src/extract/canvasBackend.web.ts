import type { CropBackend, CropOptions, CropResult } from './types';
import { CropPickerError, resolveOutputSize } from './types';
import type { CropRegion } from '../core/types';

const MIME: Record<string, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

function loadImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () =>
      reject(new CropPickerError('IMAGE_LOAD_FAILED', `Could not load image: ${uri}`));
    img.src = uri;
  });
}

/**
 * Zero-dependency web backend. Draws the source rotated about its center onto an
 * output canvas positioned so that exactly `region.rect` (in rotated-canvas space)
 * fills the output — one pass, including any resize.
 */
export function createCanvasBackend(): CropBackend {
  return {
    name: 'canvas',
    capabilities: { rotation: true },
    async crop(
      sourceUri: string,
      region: CropRegion,
      options: CropOptions = {},
    ): Promise<CropResult> {
      const img = await loadImage(sourceUri);
      const { rect, canvasSize, rotationDeg } = region;
      const out = resolveOutputSize(rect.width, rect.height, options.resize);

      const canvas = document.createElement('canvas');
      canvas.width = out.width;
      canvas.height = out.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new CropPickerError('ENCODE_FAILED', 'canvas 2d context unavailable');

      ctx.imageSmoothingQuality = 'high';
      ctx.scale(out.width / rect.width, out.height / rect.height);
      ctx.translate(-rect.x, -rect.y);
      ctx.translate(canvasSize.width / 2, canvasSize.height / 2);
      ctx.rotate((rotationDeg * Math.PI) / 180); // canvas 2d: positive = clockwise (y down)
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

      const format = options.format ?? 'jpeg';
      const mime = MIME[format] ?? MIME.jpeg;
      const quality = options.quality ?? 0.9;

      if (options.output === 'data-url') {
        const dataUrl = canvas.toDataURL(mime, quality);
        return {
          uri: dataUrl,
          width: out.width,
          height: out.height,
          base64: dataUrl.split(',')[1],
          // Browsers silently fall back to png for unsupported formats.
          mimeType: dataUrl.slice(5, dataUrl.indexOf(';')),
        };
      }

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) =>
            b ? resolve(b) : reject(new CropPickerError('ENCODE_FAILED', `toBlob returned null (${mime})`)),
          mime,
          quality,
        );
      });
      return {
        uri: URL.createObjectURL(blob),
        width: out.width,
        height: out.height,
        blob,
        mimeType: blob.type,
      };
    },
  };
}
