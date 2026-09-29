import assert from 'node:assert/strict';
import {test} from 'node:test';
import {ZoomPanMath} from '../chrome/player/utils/ZoomPanMath.mjs';

const screenOf = (v, c) => v.x + c * v.scale;

test('zoom keeps the content under the cursor fixed', () => {
  const v0 = ZoomPanMath.identity();
  const v1 = ZoomPanMath.zoomAt(v0, 2, 0.25, 0.75);
  assert.equal(v1.scale, 2);
  // content point under the anchor before zooming was 0.25 / 0.75
  assert.ok(Math.abs(screenOf(v1, 0.25) - 0.25) < 1e-9);
  assert.ok(Math.abs(v1.y + 0.75 * 2 - 0.75) < 1e-9);
  const v2 = ZoomPanMath.zoomAt(v1, 1.5, 0.6, 0.4);
  const cx = (0.6 - v1.x) / v1.scale;
  assert.ok(Math.abs(screenOf(v2, cx) - 0.6) < 1e-9);
});

test('scale clamps to [1, 8]', () => {
  let v = ZoomPanMath.identity();
  for (let i = 0; i < 50; i++) v = ZoomPanMath.zoomAt(v, 1.5, 0.5, 0.5);
  assert.equal(v.scale, 8);
  assert.equal(ZoomPanMath.zoomAt(ZoomPanMath.identity(), 0.5, 0.3, 0.3).scale, 1);
});

test('zooming out to 1x returns exactly to fit', () => {
  let v = ZoomPanMath.zoomAt(ZoomPanMath.identity(), 4, 0.9, 0.1);
  v = ZoomPanMath.panBy(v, -0.3, 0.2);
  for (let i = 0; i < 20; i++) v = ZoomPanMath.zoomAt(v, 0.7, 0.2, 0.8);
  assert.deepEqual(v, {scale: 1, x: 0, y: 0});
});

test('pan never exposes an empty edge', () => {
  const v = ZoomPanMath.zoomAt(ZoomPanMath.identity(), 2, 0.5, 0.5);
  assert.deepEqual(ZoomPanMath.panBy(v, 5, 5), {scale: 2, x: 0, y: 0});
  assert.deepEqual(ZoomPanMath.panBy(v, -5, -5), {scale: 2, x: -1, y: -1});
});

test('wheel up zooms in, wheel down zooms out, line mode is scaled', () => {
  assert.ok(ZoomPanMath.wheelFactor(-100, 0) > 1);
  assert.ok(ZoomPanMath.wheelFactor(100, 0) < 1);
  assert.equal(ZoomPanMath.wheelFactor(3, 1), ZoomPanMath.wheelFactor(48, 0));
  assert.equal(ZoomPanMath.wheelFactor(-100000, 0), ZoomPanMath.wheelFactor(-200, 0));
});
