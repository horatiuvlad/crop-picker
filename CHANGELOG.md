# Changelog

## 0.3.0 — 2026-07-24

- **Momentum fling**: a pan now carries velocity and decelerates into the bounds
  (`flingEnabled`, default on). Uses `withDecay` with an exact clamp derived from the
  new `translationBounds()` — the legal region is an axis-aligned box in translation
  space exactly at 0/90/180/270°, so momentum can never park the window off-image; at
  free rotation angles the pan settles as before.
- **`example/`**: a full Expo app (iOS/Android/web) exercising aspect switching, round
  mode, 90° rotation, reset, and a real crop through the platform backend.
- **Verified in a browser**: the example was bundled by Metro and driven end-to-end on
  react-native-web — render, live regions, every aspect, rotation, and a real
  canvas-backend crop (see the README's "Verified" table). Demo GIF added.

## 0.2.0 — 2026-07-24

Ground-up rewrite of the 2022 proof-of-concept into a real library.

- **Cross-platform for real**: one codebase for React Native (iOS/Android) and React
  Native Web, on Reanimated 3 + Gesture Handler 2 (the POC was web-only:
  react-spring + @use-gesture).
- **Pure geometry core** (`coverScale`, `clampTranslation`, `applyPinch`,
  `applyRotation`, `settleTransform`, `cropRegion`, `transformForRegion`) —
  dependency-free, worklet-ready, with brute-force-verified coverage invariants
  (2500+ random states × rotations in tests).
- **`<CropPicker />`**: pan / pinch (focal-correct) / double-tap zoom / optional free
  rotation with 90°-snap output, rubber-band overshoot + animated settle, responsive
  window sizing (`aspect`/fixed/`inset`), circular mask, replaceable overlay,
  imperative ref API (`crop`, `reset`, `rotate90`, `setZoom`, `getCropRegion`).
- **Pluggable extraction**: built-in canvas backend on web; injectable
  `expo-image-manipulator` / `@react-native-community/image-editor` factories on
  native (no optional `require`s — Metro-safe); fully headless operation supported
  (ship the `CropRegion` to a server).
- Strict TypeScript, dual CJS/ESM build with per-file `.web.js` platform forks
  preserved, vitest suite, CI workflow, MIT license.

## 0.1.x — 2022

Create-React-App proof of concept (drag scaffold, web only). Superseded.
