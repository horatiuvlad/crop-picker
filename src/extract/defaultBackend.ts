import type { CropBackend } from './types';

/**
 * Native default: none. React Native packagers resolve missing optional modules at
 * BUNDLE time, so this library never `require()`s an image-processing package it
 * doesn't declare. Instead the consumer injects one explicitly (Metro-safe, and
 * "dynamic at the extraction layer" by design):
 *
 *   import * as ImageManipulator from 'expo-image-manipulator';
 *   import { setCropBackend, createExpoImageManipulatorBackend } from '@horatiuvlad/crop-picker';
 *   setCropBackend(createExpoImageManipulatorBackend(ImageManipulator));
 *
 * On web (react-native-web resolves `defaultBackend.web.ts`) a canvas backend is
 * built in and registered automatically.
 */
export function createDefaultBackend(): CropBackend | undefined {
  return undefined;
}
