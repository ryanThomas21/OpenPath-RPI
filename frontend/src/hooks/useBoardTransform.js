import { useCallback, useEffect, useRef, useState } from 'react';
import { BOARD_PIVOT } from '../data/board.js';
import { boundsOf, clamp, lerp, rotateAroundPivot } from '../utils/geometry.js';

const MIN_SCALE = 0.45;
const MAX_SCALE = 3.2;
const EASE = 0.12;
const SETTLE_EPSILON = 0.0008;

const DEFAULT_STATE = { tx: 0, ty: 0, scale: 1, rotate: 0 };

function transformString(c) {
  return `translate(${c.tx} ${c.ty}) scale(${c.scale}) translate(${BOARD_PIVOT.x} ${BOARD_PIVOT.y}) rotate(${c.rotate}) translate(${-BOARD_PIVOT.x} ${-BOARD_PIVOT.y})`;
}

// Screen point = rotateAroundPivot(world, BOARD_PIVOT, rotate) * scale + (tx, ty)
// getSafeRect (optional) returns the sub-rect not covered by floating UI
// chrome (search card, HUD) — fits center there instead of the full canvas.
//
// groupRef points at the SVG <g> that carries the transform. The 60fps
// pan/zoom/fit easing writes straight to that DOM node instead of round-
// tripping through React state — driving a full component re-render (every
// pin, every edge, every filter) every animation frame is what was making
// pan/zoom feel choppy. React only re-renders for changes that actually
// affect JSX output (rotate, for the billboarded pin labels and compass).
export function useBoardTransform(getViewportSize, getSafeRect, groupRef) {
  const current = useRef({ ...DEFAULT_STATE });
  const target = useRef({ ...DEFAULT_STATE });
  const raf = useRef(null);
  const [, forceRender] = useState(0);

  const applyToDom = useCallback(() => {
    const el = groupRef?.current;
    if (el) el.setAttribute('transform', transformString(current.current));
  }, [groupRef]);

  const tick = useCallback(() => {
    const c = current.current;
    const t = target.current;
    let settled = true;
    for (const key of ['tx', 'ty', 'scale', 'rotate']) {
      const next = lerp(c[key], t[key], EASE);
      if (Math.abs(next - t[key]) > SETTLE_EPSILON) settled = false;
      c[key] = next;
    }
    applyToDom();
    if (!settled) {
      raf.current = requestAnimationFrame(tick);
    } else {
      raf.current = null;
    }
  }, [applyToDom]);

  const wake = useCallback(() => {
    if (raf.current == null) raf.current = requestAnimationFrame(tick);
  }, [tick]);

  useEffect(() => () => {
    if (raf.current != null) {
      cancelAnimationFrame(raf.current);
      raf.current = null;
    }
  }, []);

  const snapToTarget = useCallback(() => {
    current.current = { ...target.current };
    applyToDom();
    forceRender((n) => n + 1);
  }, [applyToDom]);

  // Immediate 1:1 drag — the hand must not lag the pointer. Pan never
  // touches rotate, so nothing here needs a React re-render.
  const panBy = useCallback((dx, dy) => {
    target.current = { ...target.current, tx: target.current.tx + dx, ty: target.current.ty + dy };
    current.current = { ...current.current, tx: current.current.tx + dx, ty: current.current.ty + dy };
    applyToDom();
  }, [applyToDom]);

  // Eased — wheel/button zoom keeps the viewport-center world point fixed.
  const zoomBy = useCallback((factor) => {
    const { width, height } = getViewportSize();
    const t = target.current;
    const nextScale = clamp(t.scale * factor, MIN_SCALE, MAX_SCALE);
    if (nextScale === t.scale) return;
    const centerScreen = { x: width / 2, y: height / 2 };
    const worldAtCenter = {
      x: (centerScreen.x - t.tx) / t.scale,
      y: (centerScreen.y - t.ty) / t.scale,
    };
    target.current = {
      ...t,
      scale: nextScale,
      tx: centerScreen.x - worldAtCenter.x * nextScale,
      ty: centerScreen.y - worldAtCenter.y * nextScale,
    };
    wake();
  }, [getViewportSize, wake]);

  // Immediate — the dial must track the hand while dragging. Rotate feeds
  // the billboarded pin labels and the compass needle, both React-rendered,
  // so this is the one mutator that still needs forceRender.
  const setRotateImmediate = useCallback((deg) => {
    target.current = { ...target.current, rotate: deg };
    current.current = { ...current.current, rotate: deg };
    applyToDom();
    forceRender((n) => n + 1);
  }, [applyToDom]);

  // Eased fit — used on route-set and on reset. Never changes rotate.
  const fitToWorldPoints = useCallback((points, pad = 90) => {
    const full = getViewportSize();
    const safe = getSafeRect ? getSafeRect() : { x: 0, y: 0, width: full.width, height: full.height };
    const rotate = target.current.rotate;
    const rotated = points.map((p) => rotateAroundPivot(p, BOARD_PIVOT, rotate));
    const bounds = boundsOf(rotated, pad);
    const scale = clamp(
      Math.min(safe.width / bounds.width, safe.height / bounds.height),
      MIN_SCALE,
      MAX_SCALE,
    );
    target.current = {
      rotate,
      scale,
      tx: safe.x + safe.width / 2 - bounds.center.x * scale,
      ty: safe.y + safe.height / 2 - bounds.center.y * scale,
    };
    wake();
  }, [getViewportSize, getSafeRect, wake]);

  // Eased — turn-by-turn nav camera. Keeps `worldPoint` pinned at `anchor`
  // (fractions of the viewport) and rotates so `headingDeg` points up, the
  // way a walking-navigation camera stays heading-up and puck-anchored.
  const followPoint = useCallback((worldPoint, headingDeg, scale, anchor) => {
    const { width, height } = getViewportSize();
    let rotate = -headingDeg;
    // Take the short way around: unwrap so the eased step never spins the
    // long way past 180° when heading crosses the 0/360 seam.
    const prevRotate = target.current.rotate;
    while (rotate - prevRotate > 180) rotate -= 360;
    while (rotate - prevRotate < -180) rotate += 360;
    const r = rotateAroundPivot(worldPoint, BOARD_PIVOT, rotate);
    const ax = width * anchor.x;
    const ay = height * anchor.y;
    target.current = {
      rotate,
      scale,
      tx: ax - r.x * scale,
      ty: ay - r.y * scale,
    };
    wake();
  }, [getViewportSize, wake]);

  return {
    current: current.current,
    target: target.current,
    panBy,
    zoomBy,
    setRotateImmediate,
    fitToWorldPoints,
    followPoint,
    snapToTarget,
  };
}
