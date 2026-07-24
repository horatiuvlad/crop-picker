/**
 * @horatiuvlad/crop-picker — cross-platform crop picker for React Native and
 * React Native Web. Four independently usable layers:
 *
 *  1. core/      pure geometry (zero deps, worklet-ready)
 *  2. hooks/     useCropperGestures — Reanimated + Gesture Handler binding
 *  3. components CropPicker + DefaultOverlay — batteries-included UI
 *  4. extract/   pluggable extraction backends (canvas built in on web)
 */

// Layer 3 — component
export { CropPicker, type CropPickerProps, type CropPickerRef } from './components/CropPicker';
export { DefaultOverlay, type OverlayProps } from './components/DefaultOverlay';

// Layer 2 — headless gesture/state binding
export {
  useCropperGestures,
  type CropperApi,
  type CropperGestureConfig,
} from './hooks/useCropperGestures';

// Layer 1 — pure core
export * from './core/types';
export * as geometry from './core/geometry';
export {
  applyPinch,
  applyRotation,
  clampScale,
  clampTranslation,
  coverScale,
  cropRegion,
  initialTransform,
  settleTransform,
  transformForRegion,
  translationBounds,
  windowPointToImagePoint,
  zoomOf,
} from './core/geometry';

// Layer 4 — extraction
export { cropImage, getCropBackend, setCropBackend } from './extract/registry';
export {
  CropPickerError,
  resolveOutputSize,
  type CropBackend,
  type CropFormat,
  type CropOptions,
  type CropPickerErrorCode,
  type CropResult,
} from './extract/types';
export {
  createExpoImageManipulatorBackend,
  type ExpoBackendOptions,
  type ExpoImageManipulatorLike,
} from './extract/expoBackend';
export { createImageEditorBackend, type ImageEditorLike } from './extract/imageEditorBackend';

// Sizing / source utilities
export { computeWindowSize, type CropAreaSpec } from './utils/window';
export { resolveImageSize, resolveSourceUri, toImageSource, type CropSource } from './utils/source';

export { CropPicker as default } from './components/CropPicker';
