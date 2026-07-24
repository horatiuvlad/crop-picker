import React from 'react';
import { StyleSheet, View } from 'react-native';

import type { Size } from '../core/types';

export interface OverlayProps {
  containerSize: Size;
  windowSize: Size;
  /** Mask color outside the crop window. */
  overlayColor?: string;
  /** N produces an N×N rule-of-thirds-style grid inside the window; 0 disables. */
  gridLines?: number;
  /** Circular window chrome (mask + border follow the circle). */
  round?: boolean;
  /** Window border color. */
  borderColor?: string;
}

const GRID_COLOR = 'rgba(255, 255, 255, 0.55)';

/**
 * The default chrome: four mask panes around the window, an optional circular
 * ring mask, a subtle window border, and grid lines. Pure RN Views — renders
 * identically on native and react-native-web. Fully replaceable via the
 * component's `renderOverlay` prop.
 */
export function DefaultOverlay({
  containerSize,
  windowSize,
  overlayColor = 'rgba(0, 0, 0, 0.55)',
  gridLines = 3,
  round = false,
  borderColor = 'rgba(255, 255, 255, 0.9)',
}: OverlayProps) {
  const padX = (containerSize.width - windowSize.width) / 2;
  const padY = (containerSize.height - windowSize.height) / 2;

  // Grid lines live INSIDE the window-clip container below (positions relative to
  // the window), so in round mode they never draw over the masked corners.
  const lines: React.ReactNode[] = [];
  if (gridLines > 1) {
    for (let i = 1; i < gridLines; i++) {
      const fx = (windowSize.width * i) / gridLines;
      const fy = (windowSize.height * i) / gridLines;
      lines.push(
        <View
          key={`v${i}`}
          style={{
            position: 'absolute',
            left: fx - StyleSheet.hairlineWidth / 2,
            top: 0,
            width: StyleSheet.hairlineWidth,
            height: windowSize.height,
            backgroundColor: GRID_COLOR,
          }}
        />,
        <View
          key={`h${i}`}
          style={{
            position: 'absolute',
            top: fy - StyleSheet.hairlineWidth / 2,
            left: 0,
            height: StyleSheet.hairlineWidth,
            width: windowSize.width,
            backgroundColor: GRID_COLOR,
          }}
        />,
      );
    }
  }

  // Circular hole: the four panes mask everything outside the window square; a ring
  // CLIPPED to the window square masks the square's corners (clipping keeps it from
  // double-darkening the panes it would otherwise overlap). Ring outer radius = W
  // always clears the square corners (0.707·W < W).
  const ringSize = windowSize.width * 2;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: padY, backgroundColor: overlayColor }} />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: padY, backgroundColor: overlayColor }} />
      <View style={{ position: 'absolute', left: 0, top: padY, width: padX, height: windowSize.height, backgroundColor: overlayColor }} />
      <View style={{ position: 'absolute', right: 0, top: padY, width: padX, height: windowSize.height, backgroundColor: overlayColor }} />

      <View
        style={{
          position: 'absolute',
          left: padX,
          top: padY,
          width: windowSize.width,
          height: windowSize.height,
          overflow: 'hidden',
        }}
      >
        {lines}
        {round ? (
          <View
            style={{
              position: 'absolute',
              left: windowSize.width / 2 - ringSize / 2,
              top: windowSize.height / 2 - ringSize / 2,
              width: ringSize,
              height: ringSize,
              borderRadius: ringSize / 2,
              borderWidth: windowSize.width / 2,
              borderColor: overlayColor,
            }}
          />
        ) : null}
      </View>

      <View
        style={{
          position: 'absolute',
          left: padX,
          top: padY,
          width: windowSize.width,
          height: windowSize.height,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor,
          borderRadius: round ? windowSize.width / 2 : 0,
        }}
      />
    </View>
  );
}
