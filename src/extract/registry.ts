import { createDefaultBackend } from './defaultBackend';
import type { CropBackend, CropOptions, CropResult } from './types';
import { CropPickerError } from './types';
import type { CropRegion } from '../core/types';

let backend: CropBackend | undefined = createDefaultBackend();

/** Replace the active extraction backend (pass undefined to clear). */
export function setCropBackend(next: CropBackend | undefined): void {
  backend = next;
}

/** The active extraction backend, if any (canvas is preset on web). */
export function getCropBackend(): CropBackend | undefined {
  return backend;
}

/**
 * Execute a crop through the active backend. This is what `CropPickerRef.crop()`
 * calls under the hood; it is exported so headless integrations can use it too.
 */
export async function cropImage(
  sourceUri: string,
  region: CropRegion,
  options?: CropOptions,
): Promise<CropResult> {
  if (!backend) {
    throw new CropPickerError(
      'NO_BACKEND',
      'No crop backend registered. On native, inject one once at startup, e.g.\n' +
        "  import * as ImageManipulator from 'expo-image-manipulator';\n" +
        "  import { setCropBackend, createExpoImageManipulatorBackend } from '@horatiuvlad/crop-picker';\n" +
        '  setCropBackend(createExpoImageManipulatorBackend(ImageManipulator));\n' +
        '(On web the canvas backend is registered automatically.)',
    );
  }
  if (region.rotationDeg !== 0 && !backend.capabilities.rotation) {
    throw new CropPickerError(
      'ROTATION_UNSUPPORTED',
      `Backend "${backend.name}" cannot execute rotated crops (rotationDeg=${region.rotationDeg}).`,
    );
  }
  return backend.crop(sourceUri, region, options);
}
