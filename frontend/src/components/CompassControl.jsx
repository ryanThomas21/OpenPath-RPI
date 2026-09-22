import { forwardRef, useCallback, useRef } from 'react';

const SIZE = 44;
const CENTER = SIZE / 2;
const TAP_THRESHOLD = 4;

function angleFromCenter(clientX, clientY, rect) {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const rad = Math.atan2(clientY - cy, clientX - cx);
  return (rad * 180) / Math.PI + 90;
}

// needleRef exposes the needle's own rotating <g> so a continuous camera
// animation (turn-by-turn navigation) can update it every frame by writing
// straight to the DOM, the same way the board's own transform does — the
// `rotate` prop still drives ordinary renders (dial drag, reset-to-north).
const CompassControl = forwardRef(function CompassControl({ rotate, onRotate }, needleRef) {
  const dialRef = useRef(null);
  const dragOrigin = useRef(null);
  const moved = useRef(false);

  const onPointerDown = useCallback((e) => {
    dragOrigin.current = { x: e.clientX, y: e.clientY };
    moved.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e) => {
    if (!dragOrigin.current) return;
    const dx = e.clientX - dragOrigin.current.x;
    const dy = e.clientY - dragOrigin.current.y;
    if (Math.hypot(dx, dy) > TAP_THRESHOLD) moved.current = true;
    if (moved.current) {
      const rect = dialRef.current.getBoundingClientRect();
      onRotate(angleFromCenter(e.clientX, e.clientY, rect));
    }
  }, [onRotate]);

  const onPointerUp = useCallback((e) => {
    if (dragOrigin.current && !moved.current) onRotate(0);
    dragOrigin.current = null;
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, [onRotate]);

  return (
    <button
      type="button"
      className="compass-btn"
      aria-label={`Rotate map, currently ${Math.round(rotate)} degrees. Drag to rotate, tap to reset north.`}
    >
      <svg
        ref={dialRef}
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={(e) => { if (dragOrigin.current && !moved.current) { dragOrigin.current = null; } }}
      >
        <g ref={needleRef} transform={`rotate(${rotate} ${CENTER} ${CENTER})`}>
          <path d={`M ${CENTER} 8 L ${CENTER + 5} ${CENTER} L ${CENTER} ${CENTER - 3} L ${CENTER - 5} ${CENTER} Z`} fill="var(--map-accent)" />
          <path d={`M ${CENTER} ${SIZE - 8} L ${CENTER + 5} ${CENTER} L ${CENTER} ${CENTER + 3} L ${CENTER - 5} ${CENTER} Z`} fill="var(--map-border-strong)" />
        </g>
      </svg>
    </button>
  );
});

export { CENTER as COMPASS_CENTER };
export default CompassControl;
