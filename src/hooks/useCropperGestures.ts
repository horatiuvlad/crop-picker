import { useLayoutEffect, useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  measure,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDecay,
  withTiming,
  type AnimatedRef,
} from 'react-native-reanimated';

import {
  applyPinch,
  applyRotation,
  clampScale,
  clampTranslation,
  coverScale,
  cropRegion,
  degToRad,
  initialTransform,
  radToDeg,
  settleTransform,
  translationBounds,
  zoomOf,
} from '../core/geometry';
import type { CropGeometry, CropRegion, CropTransform, Point } from '../core/types';

export interface CropperGestureConfig {
  /** Max zoom relative to "image exactly covers the window". Default 8. */
  maxZoom?: number;
  /** Zoom level a double-tap toggles to. Default 3. */
  doubleTapZoom?: number;
  /** Enable the two-finger free-rotation gesture. Default false. */
  rotationEnabled?: boolean;
  /**
   * Momentum: keep panning after the finger lifts, decelerating into the bounds.
   * Default true. Exact at 0/90/180/270° (where the legal region is an axis-aligned
   * box); at free rotation angles the pan settles immediately instead.
   */
  flingEnabled?: boolean;
  /** Master gesture switch. Default true. */
  enabled?: boolean;
  /** Fired with the resolved crop region whenever gestures settle. */
  onCropChange?: (region: CropRegion) => void;
  /**
   * Animated ref of the container view the gestures are attached to. REQUIRED for
   * correct pinch/rotation focal points on WEB: react-native-gesture-handler
   * reports pinch `focalX/Y` and rotation `anchorX/Y` in view-relative coordinates
   * on native but VIEWPORT coordinates on web, so on web the container's client
   * origin (via `measure`) is subtracted. Tap coordinates are view-relative on
   * every platform and need no correction.
   */
  containerRef?: AnimatedRef<Animated.View>;
}

export interface CropperApi {
  getTransform(): CropTransform;
  /** Resolved crop instruction for the CURRENT view state (null before layout). */
  getRegion(): CropRegion | null;
  /** Animate back to zoom 1, centered, rotation 0. */
  reset(): void;
  /** Animate a 90° step (clockwise by default), preserving the zoom level. */
  rotate90(clockwise?: boolean): void;
  /** Animate to a zoom level about the window center. */
  setZoom(zoom: number): void;
  /** Jump (no animation) to an explicit transform — advanced/restore use. */
  setTransform(transform: CropTransform): void;
}

const SETTLE_MS = 240;
const OVERSHOOT_RESIST = 0.45; // fraction of translation overshoot that survives while dragging
const SCALE_RESIST_POW = 0.3; // pinch resistance beyond limits: bound * (x/bound)^pow
const IS_WEB = Platform.OS === 'web';
const MIN_FLING_SPEED = 120; // px/s below which a lift is a stop, not a throw
const FLING_DECELERATION = 0.993;

/**
 * Layer 2/3: binds the pure core to Reanimated shared values + gesture handlers.
 * UI-agnostic — `CropPicker` composes it, but any custom UI can too.
 *
 * `geometry` must be non-null once the container is measured and the image size is
 * known; while null, gestures are inert and `getRegion()` returns null.
 */
export function useCropperGestures(
  geometry: CropGeometry | null,
  config: CropperGestureConfig = {},
) {
  const {
    maxZoom = 8,
    doubleTapZoom = 3,
    rotationEnabled = false,
    flingEnabled = true,
    enabled = true,
    containerRef,
  } = config;

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);

  /**
   * Gesture events are in CONTAINER coordinates; the math wants WINDOW-centered
   * coordinates. The container centers the window, so the correction is half the
   * container-minus-window on each axis — the component reports it here.
   */
  const containerPad = useSharedValue<{ x: number; y: number }>({ x: 0, y: 0 });

  // Fling bookkeeping: `flingGen` invalidates callbacks from a decay that a newer
  // gesture (or a settle) has superseded; `flingPending` counts the two axes so the
  // region is emitted once, when both have come to rest.
  const flingGen = useSharedValue(0);
  const flingPending = useSharedValue(0);

  // Latest callback without re-creating gestures when the consumer re-renders.
  const onCropChangeRef = useRef(config.onCropChange);
  onCropChangeRef.current = config.onCropChange;

  // rotate90 pressed again mid-animation must step from the last TARGET, not the
  // in-flight animated value (which rounds back and eats the step).
  const pendingRotation = useRef<{ deg: number; until: number } | null>(null);
  const emitRegion = (region: CropRegion) => {
    onCropChangeRef.current?.(region);
  };

  // Until the first snap the image would render at intrinsic scale for a frame
  // (shared values start untargeted); keep it invisible until then.
  const contentOpacity = useSharedValue(0);

  // Snap to the initial (covering, centered) state whenever the geometry changes.
  // Layout effect: on web, passive effects run after paint — a plain useEffect
  // would flash the un-snapped image for one frame.
  const geoKey = geometry
    ? `${geometry.imageSize.width}x${geometry.imageSize.height}|${geometry.windowSize.width}x${geometry.windowSize.height}`
    : 'none';
  useLayoutEffect(() => {
    if (!geometry) {
      contentOpacity.value = 0;
      return;
    }
    const t = initialTransform(geometry);
    translateX.value = t.translateX;
    translateY.value = t.translateY;
    scale.value = t.scale;
    rotation.value = t.rotation;
    contentOpacity.value = 1;
    pendingRotation.current = null;
    onCropChangeRef.current?.(cropRegion(t, geometry));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoKey]);

  const gesture = useMemo(() => {
    if (!geometry) return Gesture.Race(); // inert until measurable
    const geo = geometry;

    const current = (): CropTransform => {
      'worklet';
      return {
        translateX: translateX.value,
        translateY: translateY.value,
        scale: scale.value,
        rotation: rotation.value,
      };
    };

    const apply = (t: CropTransform) => {
      'worklet';
      translateX.value = t.translateX;
      translateY.value = t.translateY;
      scale.value = t.scale;
      rotation.value = t.rotation;
    };

    const animateTo = (t: CropTransform) => {
      'worklet';
      const cfg = { duration: SETTLE_MS, easing: Easing.out(Easing.cubic) };
      translateX.value = withTiming(t.translateX, cfg);
      translateY.value = withTiming(t.translateY, cfg);
      scale.value = withTiming(t.scale, cfg);
      rotation.value = withTiming(t.rotation, cfg);
    };

    const settle = () => {
      'worklet';
      flingGen.value += 1; // any in-flight decay callback is now stale
      const target = settleTransform(current(), geo, maxZoom);
      animateTo(target);
      runOnJS(emitRegion)(cropRegion(target, geo));
    };

    // Overshoot resistance: legal position + a damped fraction of the excess.
    const resistTranslation = (t: CropTransform): CropTransform => {
      'worklet';
      const clamped = clampTranslation(t.translateX, t.translateY, t.scale, t.rotation, geo);
      return {
        translateX: clamped.x + (t.translateX - clamped.x) * OVERSHOOT_RESIST,
        translateY: clamped.y + (t.translateY - clamped.y) * OVERSHOOT_RESIST,
        scale: t.scale,
        rotation: t.rotation,
      };
    };

    // RNGH reports pinch focal / rotation anchor in VIEW coordinates on native but
    // VIEWPORT coordinates on web — normalize to view coordinates first.
    const toViewCoords = (x: number, y: number): Point => {
      'worklet';
      if (IS_WEB && containerRef) {
        const m = measure(containerRef);
        if (m !== null) return { x: x - m.pageX, y: y - m.pageY };
      }
      return { x, y };
    };

    const toWindowCoords = (x: number, y: number): Point => {
      'worklet';
      const v = toViewCoords(x, y);
      return {
        x: v.x - geo.windowSize.width / 2 - containerPad.value.x,
        y: v.y - geo.windowSize.height / 2 - containerPad.value.y,
      };
    };

    /**
     * Momentum. Runs only when the legal region is an axis-aligned box in
     * translation space (rotation ≡ 0 mod 90°) and the scale is already legal —
     * then per-axis `withDecay` with a clamp is EXACT. Otherwise fall back to
     * settling, so momentum can never park the image outside the crop window.
     */
    const fling = (velocityX: number, velocityY: number) => {
      'worklet';
      const t = current();
      const bounds = translationBounds(t.scale, t.rotation, geo);
      const legalScale = clampScale(t.scale, t.rotation, geo, maxZoom);
      if (
        bounds === null ||
        Math.abs(legalScale - t.scale) > 1e-6 ||
        Math.hypot(velocityX, velocityY) < MIN_FLING_SPEED
      ) {
        settle();
        return;
      }

      const gen = flingGen.value + 1;
      flingGen.value = gen;
      flingPending.value = 2;
      const onAxisDone = () => {
        'worklet';
        if (flingGen.value !== gen) return; // superseded by a newer gesture
        flingPending.value -= 1;
        if (flingPending.value === 0) {
          runOnJS(emitRegion)(cropRegion(current(), geo));
        }
      };

      translateX.value = withDecay(
        {
          velocity: velocityX,
          deceleration: FLING_DECELERATION,
          clamp: [bounds.minX, bounds.maxX],
          rubberBandEffect: true,
          rubberBandFactor: 0.8,
        },
        onAxisDone,
      );
      translateY.value = withDecay(
        {
          velocity: velocityY,
          deceleration: FLING_DECELERATION,
          clamp: [bounds.minY, bounds.maxY],
          rubberBandEffect: true,
          rubberBandFactor: 0.8,
        },
        onAxisDone,
      );
    };

    const pan = Gesture.Pan()
      .enabled(enabled)
      .averageTouches(true)
      .onChange((e) => {
        'worklet';
        const t = current();
        t.translateX += e.changeX;
        t.translateY += e.changeY;
        apply(resistTranslation(t));
      })
      .onEnd((e) => {
        'worklet';
        if (flingEnabled) fling(e.velocityX, e.velocityY);
        else settle();
      });

    const pinch = Gesture.Pinch()
      .enabled(enabled)
      .onChange((e) => {
        'worklet';
        const t = current();
        const minS = coverScale(geo, t.rotation);
        const maxS = Math.max(minS, coverScale(geo, 0) * maxZoom);
        let next = t.scale * e.scaleChange;
        if (next > maxS) next = maxS * Math.pow(next / maxS, SCALE_RESIST_POW);
        else if (next < minS) next = minS * Math.pow(next / minS, SCALE_RESIST_POW);
        const focal = toWindowCoords(e.focalX, e.focalY);
        apply(resistTranslation(applyPinch(t, next / t.scale, focal)));
      })
      .onEnd(() => {
        'worklet';
        settle();
      });

    const rotate = Gesture.Rotation()
      .enabled(enabled && rotationEnabled)
      .onChange((e) => {
        'worklet';
        const t = current();
        const focal = toWindowCoords(e.anchorX, e.anchorY);
        apply(resistTranslation(applyRotation(t, e.rotationChange, focal)));
      })
      .onEnd(() => {
        'worklet';
        settle();
      });

    const doubleTap = Gesture.Tap()
      .enabled(enabled)
      .numberOfTaps(2)
      .maxDuration(280)
      .onEnd((e) => {
        'worklet';
        const t = current();
        const z = zoomOf(t.scale, t.rotation, geo);
        const targetZoom = z > (doubleTapZoom + 1) / 2 ? 1 : doubleTapZoom;
        // Tap coordinates are view-relative on every platform — no web correction.
        const focal: Point = {
          x: e.x - geo.windowSize.width / 2 - containerPad.value.x,
          y: e.y - geo.windowSize.height / 2 - containerPad.value.y,
        };
        const factor = (coverScale(geo, t.rotation) * targetZoom) / t.scale;
        const target = settleTransform(applyPinch(t, factor, focal), geo, maxZoom);
        animateTo(target);
        runOnJS(emitRegion)(cropRegion(target, geo));
      });

    return Gesture.Race(
      doubleTap,
      Gesture.Simultaneous(pan, pinch, rotate),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geoKey, maxZoom, doubleTapZoom, rotationEnabled, flingEnabled, enabled]);

  const setContainerPadding = (x: number, y: number) => {
    containerPad.value = { x, y };
  };

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotateZ: `${rotation.value}rad` },
      { scale: scale.value },
    ],
  }));

  const getTransform = (): CropTransform => ({
    translateX: translateX.value,
    translateY: translateY.value,
    scale: scale.value,
    rotation: rotation.value,
  });

  const animateFromJS = (target: CropTransform) => {
    flingGen.value += 1; // supersede any in-flight momentum
    const cfg = { duration: SETTLE_MS, easing: Easing.out(Easing.cubic) };
    translateX.value = withTiming(target.translateX, cfg);
    translateY.value = withTiming(target.translateY, cfg);
    scale.value = withTiming(target.scale, cfg);
    rotation.value = withTiming(target.rotation, cfg);
    if (geometry) emitRegion(cropRegion(target, geometry));
  };

  const api: CropperApi = {
    getTransform,
    getRegion: () => (geometry ? cropRegion(getTransform(), geometry) : null),
    reset: () => {
      if (!geometry) return;
      pendingRotation.current = { deg: 0, until: Date.now() + SETTLE_MS + 60 };
      animateFromJS(initialTransform(geometry));
    },
    rotate90: (clockwise = true) => {
      if (!geometry) return;
      const t = getTransform();
      const now = Date.now();
      const pending = pendingRotation.current;
      const stepFrom =
        pending && now < pending.until
          ? pending.deg
          : Math.round(radToDeg(t.rotation) / 90) * 90;
      const targetDeg = stepFrom + (clockwise ? 90 : -90);
      pendingRotation.current = { deg: targetDeg, until: now + SETTLE_MS + 60 };
      const targetRot = degToRad(targetDeg);
      const zoom = zoomOf(t.scale, t.rotation, geometry);
      const newScale = coverScale(geometry, targetRot) * zoom;
      const delta = targetRot - t.rotation;
      const rotated = applyRotation(t, delta, { x: 0, y: 0 });
      const target = settleTransform(
        { ...rotated, scale: newScale, rotation: targetRot },
        geometry,
        maxZoom,
      );
      animateFromJS(target);
    },
    setZoom: (zoom: number) => {
      if (!geometry) return;
      const t = getTransform();
      const factor = (coverScale(geometry, t.rotation) * zoom) / t.scale;
      const target = settleTransform(applyPinch(t, factor, { x: 0, y: 0 }), geometry, maxZoom);
      animateFromJS(target);
    },
    /**
     * NOTE (native): shared-value writes from the JS thread land on the UI runtime
     * asynchronously, while reads are synchronous — `setTransform` followed by
     * `getTransform`/`getRegion` in the SAME tick may observe the previous state.
     * Read on the next frame (or use the value you just set).
     */
    setTransform: (transform: CropTransform) => {
      pendingRotation.current = null;
      translateX.value = transform.translateX;
      translateY.value = transform.translateY;
      scale.value = transform.scale;
      rotation.value = transform.rotation;
    },
  };

  return { gesture, animatedStyle, api, setContainerPadding };
}
