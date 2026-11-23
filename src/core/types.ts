/** Width/height pair, in whatever unit the context implies (image px or screen dp). */
export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The full view-state of the cropper.
 *
 * Coordinate model (the ONE convention everything in this library follows):
 *  - The crop window is an axis-aligned rect of size `windowSize`, centered at the origin
 *    of "window space" (screen dp, y down).
 *  - The image is drawn centered at the origin, scaled by `scale`, rotated by `rotation`
 *    (radians, clockwise, matching screen coords with y down), then translated by
 *    `(translateX, translateY)` in window space:
 *
 *        p_screen = R(rotation) · (scale · p_image) + t
 *
 *    which is exactly the React Native transform list
 *    `[{translateX}, {translateY}, {rotateZ}, {scale}]`.
 */
export interface CropTransform {
  translateX: number;
  translateY: number;
  /** Absolute scale factor from image pixels to window units. */
  scale: number;
  /** Radians, clockwise (screen coords, y down). */
  rotation: number;
}

/** Static geometry the math needs: the source bitmap size and the crop window size. */
export interface CropGeometry {
  /** Intrinsic bitmap size, in image pixels. */
  imageSize: Size;
  /** Crop window size, in window units (screen dp). */
  windowSize: Size;
}

/**
 * What a crop resolves to, expressed so ANY extraction backend can execute it:
 * rotate the source image by `rotationDeg` about its center (canvas grows to the
 * rotated bounding box `canvasSize`), then cut the axis-aligned `rect` out of that
 * canvas. When `rotationDeg === 0`, `canvasSize` equals the image size and `rect`
 * is simply a rect in original image pixels.
 */
export interface CropRegion {
  /** Clockwise degrees, normalized to [0, 360). */
  rotationDeg: number;
  /** Size of the rotated canvas (= image bounding box after rotation), image px. */
  canvasSize: Size;
  /** Crop rect inside that canvas, image px, integer, clamped to the canvas. */
  rect: Rect;
}
