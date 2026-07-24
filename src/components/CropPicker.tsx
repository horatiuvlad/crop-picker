import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import {
  Image,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedRef } from 'react-native-reanimated';

import type { CropGeometry, CropRegion, CropTransform, Size } from '../core/types';
import { cropImage } from '../extract/registry';
import { CropPickerError, type CropOptions, type CropResult } from '../extract/types';
import { useCropperGestures, type CropperApi } from '../hooks/useCropperGestures';
import { resolveImageSize, resolveSourceUri, toImageSource, type CropSource } from '../utils/source';
import { computeWindowSize, type CropAreaSpec } from '../utils/window';
import { DefaultOverlay } from './DefaultOverlay';

export interface CropPickerProps {
  /** Image to crop: uri string, `{uri}` object, or `require(...)` module. */
  source: CropSource;
  /**
   * Intrinsic bitmap size. Optional — auto-detected via Image.getSize /
   * resolveAssetSource — but passing it avoids a roundtrip and is REQUIRED where
   * auto-detection can't work (module assets on some web setups).
   */
  imageSize?: Size;
  /** Crop window sizing spec (aspect / fixed size / inset). Default: square, inset 24. */
  cropArea?: CropAreaSpec;
  /** Max zoom relative to "image exactly covers the window". Default 8. */
  maxZoom?: number;
  /** Zoom level a double-tap toggles to. Default 3. */
  doubleTapZoom?: number;
  /** Two-finger free rotation. Default false (most products want 90° steps only). */
  rotationEnabled?: boolean;
  /** Momentum after a pan (decelerates into the bounds). Default true. */
  flingEnabled?: boolean;
  /** Master interaction switch. Default true. */
  enabled?: boolean;
  /** Circular crop chrome (forces a 1:1 window). Extraction output stays square. */
  round?: boolean;
  /** Mask color outside the window. */
  overlayColor?: string;
  /** N×N grid inside the window; 0 disables. Default 3. */
  gridLines?: number;
  /** Replace the entire overlay layer with your own chrome. */
  renderOverlay?: (state: { containerSize: Size; windowSize: Size }) => React.ReactNode;
  /** Container style (size the cropper with this; defaults to flex: 1). */
  style?: StyleProp<ViewStyle>;
  /** Fired once layout + image size are known and interaction is live. */
  onReady?: (geometry: CropGeometry) => void;
  /** Fired with the resolved crop region every time gestures/API settle. */
  onCropChange?: (region: CropRegion) => void;
  /** Image-size auto-detection failure. */
  onError?: (error: Error) => void;
  /** Test hook. */
  testID?: string;
}

export interface CropPickerRef {
  /** Resolve the current region and run it through the active extraction backend. */
  crop(options?: CropOptions): Promise<CropResult>;
  /** The crop instruction for the current view state (null before ready). */
  getCropRegion(): CropRegion | null;
  getTransform(): CropTransform;
  setTransform(transform: CropTransform): void;
  reset(): void;
  rotate90(clockwise?: boolean): void;
  setZoom(zoom: number): void;
}

/**
 * Batteries-included, cross-platform (React Native + React Native Web) crop picker:
 * fixed window, image pans/pinches/rotates underneath, overlay fully replaceable,
 * extraction pluggable. See useCropperGestures/core for the headless layers.
 */
export const CropPicker = forwardRef<CropPickerRef, CropPickerProps>(function CropPicker(
  {
    source,
    imageSize: imageSizeProp,
    cropArea,
    maxZoom = 8,
    doubleTapZoom = 3,
    rotationEnabled = false,
    flingEnabled = true,
    enabled = true,
    round = false,
    overlayColor,
    gridLines = 3,
    renderOverlay,
    style,
    onReady,
    onCropChange,
    onError,
    testID,
  },
  ref,
) {
  const [containerSize, setContainerSize] = useState<Size | null>(null);
  const [detectedSize, setDetectedSize] = useState<Size | null>(null);

  const imageSize = imageSizeProp ?? detectedSize;

  // Auto-detect intrinsic size when not provided.
  const sourceKey =
    typeof source === 'string' ? source : JSON.stringify(source ?? null);
  useEffect(() => {
    if (imageSizeProp) return;
    let alive = true;
    setDetectedSize(null);
    resolveImageSize(source)
      .then((s) => {
        if (alive) setDetectedSize(s);
      })
      .catch((e: Error) => {
        if (alive) onError?.(e);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey, imageSizeProp]);

  // Memos keyed on PRIMITIVES: consumers pass `imageSize`/`cropArea` as inline
  // object literals, and keying on object identity would rebuild geometry every
  // parent render — re-firing onReady (and looping if onReady sets state).
  const windowSize = useMemo(
    () => (containerSize ? computeWindowSize(containerSize, cropArea, round) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      containerSize?.width,
      containerSize?.height,
      cropArea?.aspect,
      cropArea?.width,
      cropArea?.height,
      cropArea?.inset,
      round,
    ],
  );

  const imageW = imageSize?.width;
  const imageH = imageSize?.height;
  const geometry: CropGeometry | null = useMemo(
    () =>
      imageW && imageH && windowSize
        ? { imageSize: { width: imageW, height: imageH }, windowSize }
        : null,
    [imageW, imageH, windowSize],
  );

  const containerRef = useAnimatedRef<Animated.View>();
  const { gesture, animatedStyle, api, setContainerPadding } = useCropperGestures(geometry, {
    maxZoom,
    doubleTapZoom,
    rotationEnabled,
    flingEnabled,
    enabled,
    onCropChange,
    containerRef,
  });

  useEffect(() => {
    if (containerSize && windowSize) {
      setContainerPadding(
        (containerSize.width - windowSize.width) / 2,
        (containerSize.height - windowSize.height) / 2,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerSize, windowSize]);

  useEffect(() => {
    if (geometry) onReady?.(geometry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geometry]);

  useImperativeHandle(
    ref,
    (): CropPickerRef => ({
      async crop(options?: CropOptions) {
        const region = api.getRegion();
        if (!region) {
          throw new CropPickerError('NOT_READY', 'CropPicker is not laid out yet.');
        }
        const uri = resolveSourceUri(source);
        if (!uri) {
          throw new CropPickerError(
            'IMAGE_LOAD_FAILED',
            'crop() needs a source with a resolvable uri.',
          );
        }
        return cropImage(uri, region, options);
      },
      getCropRegion: () => api.getRegion(),
      getTransform: () => api.getTransform(),
      setTransform: (t) => api.setTransform(t),
      reset: () => api.reset(),
      rotate90: (clockwise) => api.rotate90(clockwise),
      setZoom: (z) => api.setZoom(z),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [api, sourceKey],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setContainerSize((prev) =>
      prev && prev.width === width && prev.height === height ? prev : { width, height },
    );
  };

  return (
    <GestureHandlerRootView style={[styles.root, style]} testID={testID}>
      <Animated.View ref={containerRef} style={styles.container} onLayout={onLayout}>
        {geometry && containerSize ? (
          <GestureDetector gesture={gesture}>
            <View style={StyleSheet.absoluteFill} collapsable={false}>
              <Animated.View
                style={[
                  {
                    position: 'absolute',
                    left: containerSize.width / 2 - geometry.imageSize.width / 2,
                    top: containerSize.height / 2 - geometry.imageSize.height / 2,
                    width: geometry.imageSize.width,
                    height: geometry.imageSize.height,
                  },
                  animatedStyle,
                ]}
              >
                <Image
                  source={toImageSource(source)}
                  style={StyleSheet.absoluteFill}
                  resizeMode="stretch"
                  fadeDuration={0}
                />
              </Animated.View>
              {renderOverlay ? (
                renderOverlay({ containerSize, windowSize: geometry.windowSize })
              ) : (
                <DefaultOverlay
                  containerSize={containerSize}
                  windowSize={geometry.windowSize}
                  overlayColor={overlayColor}
                  gridLines={gridLines}
                  round={round}
                />
              )}
            </View>
          </GestureDetector>
        ) : null}
      </Animated.View>
    </GestureHandlerRootView>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1, overflow: 'hidden' },
});
