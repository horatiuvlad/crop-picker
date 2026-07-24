# @horatiuvlad/crop-picker

[![ci](https://github.com/horatiuvlad/crop-picker/actions/workflows/ci.yml/badge.svg)](https://github.com/horatiuvlad/crop-picker/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@horatiuvlad/crop-picker.svg)](https://www.npmjs.com/package/@horatiuvlad/crop-picker)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![platforms](https://img.shields.io/badge/platforms-iOS%20%7C%20Android%20%7C%20Web-informational)](#)

**One crop picker for React Native _and_ React Native Web.** Fixed crop window, image
pans / pinch-zooms / rotates underneath (the Instagram model), built on the modern
cross-platform stack — Reanimated 3 + Gesture Handler 2 — with a pure-math core and
pluggable extraction backends.

Why this exists: the ecosystem is split into web-only croppers (`react-easy-crop`,
`react-image-crop`, …) and native-only croppers (`react-native-image-crop-picker`, …).
If your app is a single React Native codebase that also ships to the web, there is no
maintained interactive cropper that runs on both. This is that library.

![crop-picker demo — square, 4:5, 16:9 and round crop windows](./assets/demo.gif)

<sub>The `example/` app running **on the web** through react-native-web — same component
that renders on iOS and Android. Aspect switching, round mask, 90° rotation, and a real
crop through the canvas backend.</sub>

- 🫳 **Gestures**: pan with **momentum fling**, pinch-zoom about the focal point,
  double-tap zoom, optional two-finger rotation — 60 fps on the UI thread via
  Reanimated worklets, rubber-band overshoot with spring-back clamping.
- 🧮 **Provably-correct core**: all geometry is pure, dependency-free TypeScript
  (`coverScale`, `clampTranslation`, `cropRegion`, …) with brute-force-verified
  invariants — the crop window can never escape the image, at any rotation.
- 🧩 **Dynamic at every layer** — use as much or as little as you want:
  | Layer | What | Swap it by |
  | --- | --- | --- |
  | core | pure crop math | importing the functions directly |
  | hook | `useCropperGestures` | building your own UI on top |
  | component | `<CropPicker />` | `renderOverlay`, style & sizing props |
  | extraction | `cropImage` + backends | `setCropBackend(...)` |
- 🖼️ **Extraction included**: canvas backend built in on web (zero config); on native
  inject Expo's `expo-image-manipulator` or `@react-native-community/image-editor`
  with one line — or run fully headless and send the crop rect to your server.
- 📐 **Responsive window**: aspect-ratio or fixed-size crop windows, insets, circular
  mask — recomputed on every layout.

## Try it

```sh
git clone https://github.com/horatiuvlad/crop-picker && cd crop-picker
npm install && cd example && npm install
npm run web        # or: npm run ios / npm run android
```

The [`example/`](./example) app (Expo) exercises every feature: aspect switching,
round mode, 90° rotation, reset, and a real crop through the platform's backend —
canvas on web, `expo-image-manipulator` on native, injected in one line.

## Install

```sh
npm install @horatiuvlad/crop-picker
# peer deps (you almost certainly have them already):
npm install react-native-gesture-handler react-native-reanimated
```

Reanimated needs its Babel plugin and Gesture Handler its one-time setup — follow
their standard install docs. On web, this works wherever `react-native-web` +
Reanimated/Gesture Handler web support are configured (Expo web works out of the box).

## Quickstart

```tsx
import React, { useRef } from 'react';
import { Button, View } from 'react-native';
import { CropPicker, type CropPickerRef } from '@horatiuvlad/crop-picker';

export function Avatar() {
  const cropper = useRef<CropPickerRef>(null);
  return (
    <View style={{ flex: 1 }}>
      <CropPicker
        ref={cropper}
        source={{ uri: 'https://example.com/photo.jpg' }}
        cropArea={{ aspect: 1 }}
        round
        onCropChange={(region) => console.log(region.rect)}
      />
      <Button
        title="Crop"
        onPress={async () => {
          const { uri, width, height } = await cropper.current!.crop({
            format: 'jpeg',
            quality: 0.9,
            resize: { width: 512 },
          });
          console.log(uri, width, height);
        }}
      />
    </View>
  );
}
```

### Native extraction backend (one line, at startup)

On **web** the built-in canvas backend is registered automatically. On **native**,
inject whichever engine your app already uses (this keeps Metro happy — the library
never imports optional native modules itself):

```ts
// Expo
import * as ImageManipulator from 'expo-image-manipulator';
import { setCropBackend, createExpoImageManipulatorBackend } from '@horatiuvlad/crop-picker';
setCropBackend(createExpoImageManipulatorBackend(ImageManipulator));
```

```ts
// Bare RN (no rotation support in this engine — keep rotationEnabled off)
import ImageEditor from '@react-native-community/image-editor';
import { setCropBackend, createImageEditorBackend } from '@horatiuvlad/crop-picker';
setCropBackend(createImageEditorBackend(ImageEditor));
```

No backend at all? Everything except `crop()` still works — take the `CropRegion`
from `onCropChange`/`getCropRegion()` and crop server-side; it is a complete,
backend-agnostic instruction (`rotate by N°, then cut rect out of the rotated canvas`).

## `<CropPicker />` props

| Prop | Type / default | |
| --- | --- | --- |
| `source` | uri string, `{uri}`, or `require(...)` | image to crop |
| `imageSize` | `{width, height}` | intrinsic px; auto-detected if omitted |
| `cropArea` | `{aspect?, width?, height?, inset?}` — `{aspect: 1, inset: 24}` | window sizing spec, responsive to layout |
| `maxZoom` | `8` | max zoom (× the "exactly covers window" scale) |
| `doubleTapZoom` | `3` | zoom a double-tap toggles to |
| `rotationEnabled` | `false` | two-finger free rotation (snaps output near 90° steps) |
| `flingEnabled` | `true` | momentum after a pan (exact bounds at 0/90/180/270°) |
| `round` | `false` | circular chrome, forces 1:1 window |
| `overlayColor` / `gridLines` | `rgba(0,0,0,0.55)` / `3` | default chrome knobs |
| `renderOverlay` | `({containerSize, windowSize}) => ReactNode` | replace the whole overlay |
| `onReady` / `onCropChange` / `onError` | callbacks | `onCropChange` fires with a `CropRegion` on every settle |
| `enabled` / `style` / `testID` | | |

**Ref API**: `crop(options)`, `getCropRegion()`, `getTransform()`, `setTransform(t)`,
`reset()`, `rotate90(clockwise?)`, `setZoom(z)`.

**`crop(options)`**: `{ format?: 'jpeg'|'png'|'webp', quality?: 0..1, resize?: {width?, height?}, output?: 'object-url'|'data-url' /* web */ }`
→ `{ uri, width, height, blob? /* web */, base64? }`.

## Headless / custom UI

```tsx
import {
  useCropperGestures, cropRegion, transformForRegion, coverScale,
} from '@horatiuvlad/crop-picker';

const { gesture, animatedStyle, api } = useCropperGestures(geometry, { maxZoom: 6 });
// render your own image + chrome; wrap in <GestureDetector gesture={gesture}>
```

Or skip React entirely — the core is plain math:

```ts
import { cropRegion, settleTransform } from '@horatiuvlad/crop-picker';
const region = cropRegion(transform, { imageSize, windowSize });
```

## The coordinate model (for integrators)

The crop window is centered at the origin of window space. The image is centered,
scaled by `scale`, rotated by `rotation` (radians, clockwise, y-down), translated by
`(translateX, translateY)`:

```
p_screen = R(rotation) · (scale · p_image) + t
```

A crop resolves to a `CropRegion`: rotate the source by `rotationDeg` about its
center (canvas grows to `canvasSize`), then cut the axis-aligned `rect` — which is
exactly the instruction every extraction engine (canvas, expo, server-side sharp)
can execute. Rotations within 0.75° of a 90° step are snapped, so the common cases
produce exact crops.

## Architecture

```
src/core      pure geometry (zero deps; 'worklet'-tagged so the same functions run
              on the Reanimated UI thread; brute-force-tested invariants)
src/hooks     useCropperGestures — shared values + gesture composition + settle logic
src/components CropPicker + DefaultOverlay (mask, grid, ring — plain RN Views)
src/extract   CropBackend registry; canvas backend (web, auto), Expo + ImageEditor
              factories (injected, never imported — Metro-safe)
```

Platform forking uses the standard `.web.ts` mechanism, preserved per-file in the
published build, so web bundlers pick the canvas default and Metro picks the inert
native default with zero configuration.

## Verified

Beyond the unit suite (31 cases, incl. brute-force invariants over thousands of random
states × rotations), the `example/` app was **run in a real browser** through
react-native-web and driven end-to-end:

| Check | Result |
| --- | --- |
| Metro bundles the library from source (incl. `.web.ts` forks, worklets) | 580 modules, no resolution errors |
| Component renders, measures, and emits a live region | `rot 0° rect 1063×1063 @ 269,0` on a 1600×1063 photo — exact centered square |
| Aspect windows | 4:5 → `850×1063` (0.7996); 16:9 → `1600×900 @ 0,82` — pixel-exact, correctly centered |
| 90° rotation | region transposes `@269,0` → `@0,269` — exact canvas-space swap |
| `crop()` through the canvas backend | `blob:` URL decoding to **1063×1063**, `image/jpeg` |
| Rotated crop output | WYSIWYG — output matches the rotated window content |

## Caveats, honestly

- The **interactive UI** requires Reanimated ≥ 3.6 and Gesture Handler ≥ 2.14 (the
  core and extraction layers work without them).
- `@react-native-community/image-editor` cannot rotate — pair rotation with the Expo
  backend or the web canvas.
- Some Expo SDK versions rotate counter-clockwise for positive degrees; if rotated
  crops come out wrong, flip `createExpoImageManipulatorBackend(m, { counterClockwise: true })`.
- On web, cross-origin images need CORS headers (the canvas backend sets
  `crossOrigin='anonymous'`).
- On web, `crop()` returns an **object URL** — call `URL.revokeObjectURL(result.uri)`
  when you're done with it (or use `output: 'data-url'`). Browsers that can't encode
  a requested format fall back to PNG silently — check `result.mimeType`.
- `setTransform()` followed by `getCropRegion()` in the same tick may read the
  previous state on native (Reanimated writes are async, reads sync) — read on the
  next frame.

## License

MIT © Horatiu Vlad
