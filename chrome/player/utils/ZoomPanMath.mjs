/**
 * Pure math for cursor-anchored zoom and pan of the video view.
 *
 * The view is described by a scale and a translation expressed as a
 * FRACTION of the viewport size (x, y), so the same state stays valid when
 * the player is resized (e.g. entering or leaving fullscreen).
 *
 * Screen position of a content point c (both in viewport fractions):
 *   screen = translate + c * scale
 */
export class ZoomPanMath {
  static MIN_SCALE = 1;
  static MAX_SCALE = 8;

  /**
   * Returns the identity view (fit to viewport).
   * @return {{scale: number, x: number, y: number}}
   */
  static identity() {
    return {scale: 1, x: 0, y: 0};
  }

  /**
   * Clamps a scale to the allowed range.
   * @param {number} scale
   * @return {number}
   */
  static clampScale(scale) {
    return Math.min(ZoomPanMath.MAX_SCALE, Math.max(ZoomPanMath.MIN_SCALE, scale));
  }

  /**
   * Keeps the zoomed content covering the whole viewport (no empty edges).
   * At scale 1 this always yields a zero translation.
   * @param {{scale: number, x: number, y: number}} view
   * @return {{scale: number, x: number, y: number}}
   */
  static clampView(view) {
    const min = 1 - view.scale;
    return {
      scale: view.scale,
      x: Math.min(0, Math.max(min, view.x)),
      y: Math.min(0, Math.max(min, view.y)),
    };
  }

  /**
   * Zooms by a factor while keeping the content under the anchor fixed.
   * @param {{scale: number, x: number, y: number}} view
   * @param {number} factor - Multiplier applied to the current scale.
   * @param {number} ax - Anchor x as a fraction of the viewport width.
   * @param {number} ay - Anchor y as a fraction of the viewport height.
   * @return {{scale: number, x: number, y: number}}
   */
  static zoomAt(view, factor, ax, ay) {
    const scale = ZoomPanMath.clampScale(view.scale * factor);
    if (scale === ZoomPanMath.MIN_SCALE) {
      return ZoomPanMath.identity();
    }
    const cx = (ax - view.x) / view.scale;
    const cy = (ay - view.y) / view.scale;
    return ZoomPanMath.clampView({
      scale,
      x: ax - cx * scale,
      y: ay - cy * scale,
    });
  }

  /**
   * Moves the view by a delta expressed in viewport fractions.
   * @param {{scale: number, x: number, y: number}} view
   * @param {number} dx
   * @param {number} dy
   * @return {{scale: number, x: number, y: number}}
   */
  static panBy(view, dx, dy) {
    return ZoomPanMath.clampView({
      scale: view.scale,
      x: view.x + dx,
      y: view.y + dy,
    });
  }

  /**
   * Converts a wheel event delta into a zoom factor. Negative deltaY
   * (wheel up / away from the user) zooms in.
   * @param {number} deltaY
   * @param {number} deltaMode - 0 pixels, 1 lines, 2 pages.
   * @return {number}
   */
  static wheelFactor(deltaY, deltaMode) {
    let px = deltaY;
    if (deltaMode === 1) {
      px *= 16;
    } else if (deltaMode === 2) {
      px *= 400;
    }
    // Cap a single event so a fast flick cannot jump straight to max.
    px = Math.max(-200, Math.min(200, px));
    return Math.exp(-px * 0.0015);
  }
}
