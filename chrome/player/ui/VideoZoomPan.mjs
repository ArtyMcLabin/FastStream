import {ZoomPanMath} from '../utils/ZoomPanMath.mjs';
import {DOMElements} from './DOMElements.mjs';

// Pointer travel (px) before a press counts as a drag rather than a click.
const DRAG_THRESHOLD = 5;

/**
 * Mouse-wheel zoom anchored at the cursor, plus drag-to-pan while zoomed.
 *
 * The transform is applied to the video CONTAINER, so the video element's
 * own transform (flip / rotate / persistent zoom option) is untouched, and
 * sibling layers (subtitles, controls) are never scaled.
 */
export class VideoZoomPan {
  constructor() {
    this.view = ZoomPanMath.identity();
    this.pointer = null;
    this.dragged = false;
    this.suppressClick = false;
    /** @type {?function(): void} */
    this.onDragStart = null;
    this.setupUI();
  }

  isZoomed() {
    return this.view.scale > ZoomPanMath.MIN_SCALE;
  }

  /**
   * True from the moment a press became a drag until the next press.
   * @return {boolean}
   */
  hasDragged() {
    return this.dragged;
  }

  reset() {
    this.endDrag();
    this.view = ZoomPanMath.identity();
    this.apply();
  }

  apply() {
    const container = DOMElements.videoContainer;
    const {scale, x, y} = this.view;
    if (scale === ZoomPanMath.MIN_SCALE) {
      container.style.transform = '';
      container.classList.remove('zoomed');
      return;
    }
    // translate() percentages refer to the container's own (untransformed)
    // size, which equals the viewport, so the state survives resizes.
    container.style.transform = `translate(${x * 100}%, ${y * 100}%) scale(${scale})`;
    container.classList.add('zoomed');
  }

  viewportRect() {
    return DOMElements.playerContainer.getBoundingClientRect();
  }

  isOverVideo(target) {
    return DOMElements.videoContainer.contains(target) || DOMElements.subtitlesContainer.contains(target);
  }

  onWheel(e) {
    // Ctrl+wheel stays the browser's page zoom; only plain wheel over the
    // picture (or the subtitles on top of it) zooms the video.
    if (e.ctrlKey || e.metaKey || !this.isOverVideo(e.target)) {
      return;
    }
    const rect = this.viewportRect();
    if (rect.width === 0 || rect.height === 0) {
      return;
    }
    const factor = ZoomPanMath.wheelFactor(e.deltaY, e.deltaMode);
    const ax = (e.clientX - rect.left) / rect.width;
    const ay = (e.clientY - rect.top) / rect.height;
    this.view = ZoomPanMath.zoomAt(this.view, factor, ax, ay);
    this.apply();
    e.preventDefault();
    e.stopPropagation();
  }

  onPointerDown(e) {
    this.dragged = false;
    this.suppressClick = false;
    if (e.button !== 0 || !this.isZoomed()) {
      return;
    }
    this.pointer = {id: e.pointerId, lastX: e.clientX, lastY: e.clientY, startX: e.clientX, startY: e.clientY};
  }

  onPointerMove(e) {
    const p = this.pointer;
    if (!p || e.pointerId !== p.id) {
      return;
    }
    if (!this.dragged) {
      if (Math.hypot(e.clientX - p.startX, e.clientY - p.startY) < DRAG_THRESHOLD) {
        return;
      }
      this.dragged = true;
      if (this.onDragStart) {
        this.onDragStart();
      }
      DOMElements.videoContainer.classList.add('panning');
      try {
        DOMElements.videoContainer.setPointerCapture(p.id);
      } catch (err) {
        // Pointer already released; the drag simply ends on the next event.
      }
    }
    const rect = this.viewportRect();
    this.view = ZoomPanMath.panBy(this.view, (e.clientX - p.lastX) / rect.width, (e.clientY - p.lastY) / rect.height);
    p.lastX = e.clientX;
    p.lastY = e.clientY;
    this.apply();
  }

  onPointerUp(e) {
    const p = this.pointer;
    if (!p || e.pointerId !== p.id) {
      return;
    }
    if (this.dragged) {
      // The browser still fires a click after the drag; swallow that one.
      this.suppressClick = true;
    }
    this.endDrag();
  }

  endDrag() {
    if (this.pointer) {
      try {
        DOMElements.videoContainer.releasePointerCapture(this.pointer.id);
      } catch (err) {
        // Capture was never taken or already released.
      }
    }
    this.pointer = null;
    DOMElements.videoContainer.classList.remove('panning');
  }

  onClickCapture(e) {
    if (this.suppressClick && DOMElements.videoContainer.contains(e.target)) {
      this.suppressClick = false;
      e.stopPropagation();
      e.preventDefault();
    }
  }

  setupUI() {
    const player = DOMElements.playerContainer;
    const container = DOMElements.videoContainer;
    player.addEventListener('wheel', this.onWheel.bind(this), {passive: false});
    container.addEventListener('pointerdown', this.onPointerDown.bind(this));
    container.addEventListener('pointermove', this.onPointerMove.bind(this));
    container.addEventListener('pointerup', this.onPointerUp.bind(this));
    container.addEventListener('pointercancel', this.onPointerUp.bind(this));
    // Capture phase on the parent runs before the container's own click
    // handler, so a finished drag never toggles play/pause.
    player.addEventListener('click', this.onClickCapture.bind(this), true);
  }
}
