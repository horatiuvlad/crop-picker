import { createCanvasBackend } from './canvasBackend.web';
import type { CropBackend } from './types';

/** Web default: the built-in canvas backend (no dependencies). */
export function createDefaultBackend(): CropBackend | undefined {
  return createCanvasBackend();
}
