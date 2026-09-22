import { useCallback, useEffect, useRef } from 'react';
import { BOARD_VIEWBOX, BUILDINGS, EDGES, JUNCTIONS, NODES } from '../data/board.js';
import { clamp, pathLength, pointsToPath, sampleAlongPath } from '../utils/geometry.js';
import { BUILDING_FOOTPRINT, CITY_STREETS, PARK_BLOBS, TREE_CANOPY, WATER_PATH } from '../utils/mapDecor.js';
import { useBoardTransform } from '../hooks/useBoardTransform.js';
import CompassControl, { COMPASS_CENTER } from './CompassControl.jsx';
import ZoomControls from './ZoomControls.jsx';

// Turn-by-turn camera: closer than any overview fit, puck held low so most
// of the screen shows the path ahead — Apple Maps' walking-nav framing.
const NAV_SCALE = 2.6;
const NAV_ANCHOR = { x: 0.5, y: 0.64 };
// Simulated walking pace for the demo camera (world units/sec), clamped so
// short and long routes both take a legible, not tedious, amount of time.
const NAV_SECONDS_PER_UNIT = 1 / 55;

function edgePath(edge) {
  const a = NODES[edge.a];
  const b = NODES[edge.b];
  return pointsToPath([a, b]);
}

// Google/Apple-style teardrop marker, tip anchored at (x, y). Billboarded:
// counter-rotated against the map's own rotation so the pin and its label
// always read upright, the way every real map app renders place markers.
// Position (translate) and billboard (rotate) are separate nested groups:
// translate is static JSX, but rotate also gets written to directly by the
// navigation camera loop every frame (billboardRef), so labels keep facing
// up through a continuous rotation, not just on the renders React actually
// runs (a plain dial drag re-renders; the nav camera intentionally doesn't).
function Pin({ x, y, kind, label, counterRotate, billboardRef }) {
  const fill =
    kind === 'start' ? 'var(--pin-start)' : kind === 'end' ? 'var(--pin-end)' : kind === 'transit' ? 'var(--pin-transit)' : 'var(--pin-idle)';
  const scale = kind === 'idle' ? 0.82 : 1;
  return (
    <g transform={`translate(${x} ${y})`}>
      <g ref={billboardRef} transform={`rotate(${counterRotate})`}>
        <g transform={`translate(${-12 * scale} ${-27 * scale}) scale(${scale})`} className="pin">
          <path
            d="M12 0C7.03 0 3 4.03 3 9c0 6.75 9 15 9 15s9-8.25 9-15c0-4.97-4.03-9-9-9z"
            fill={fill}
            stroke="rgba(20,30,25,0.18)"
            strokeWidth="0.5"
          />
          <circle cx="12" cy="9.2" r="3.6" fill="#ffffff" />
        </g>
        <text x={0} y={-34 * scale} textAnchor="middle" className={`pin-label${kind !== 'idle' ? ' pin-label-active' : ''}`}>
          {label}
        </text>
      </g>
    </g>
  );
}

export default function BoardMap({ route, startId, endId, navigating }) {
  const svgRef = useRef(null);
  const groupRef = useRef(null);
  const routePathRef = useRef(null);
  const puckRef = useRef(null);
  const pinBillboardRefs = useRef({});
  const compassNeedleRef = useRef(null);

  const getViewportSize = useCallback(() => {
    const el = svgRef.current;
    if (!el) return { width: 1, height: 1 };
    const rect = el.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }, []);

  // The search card and HUD float over the canvas — fit routes into the
  // area they leave clear, not the full viewport, or content hides beneath them.
  const getSafeRect = useCallback(() => {
    const { width, height } = getViewportSize();
    const mobile = width <= 640;
    const hudInset = 76;
    if (mobile) {
      const bottomInset = 250;
      return { x: 0, y: 0, width, height: Math.max(140, height - bottomInset) };
    }
    const leftInset = 336;
    return { x: leftInset, y: 0, width: Math.max(140, width - leftInset - hudInset), height };
  }, [getViewportSize]);

  const transform = useBoardTransform(getViewportSize, getSafeRect, groupRef);
  const { current, panBy, zoomBy, setRotateImmediate, fitToWorldPoints, followPoint } = transform;

  const routeRef = useRef(route);
  routeRef.current = route;

  const refit = useCallback(() => {
    const activeRoute = routeRef.current;
    if (activeRoute && activeRoute.points.length) {
      fitToWorldPoints(activeRoute.points);
    } else {
      fitToWorldPoints(BUILDINGS.map((b) => ({ x: b.x, y: b.y })), 150);
    }
  }, [fitToWorldPoints]);

  useEffect(() => {
    refit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  // Re-fit whenever the viewport itself changes size (resize, rotation,
  // devtools panel, orientation change) — the previous fit is stale otherwise.
  useEffect(() => {
    const el = svgRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    let first = true;
    const observer = new ResizeObserver(() => {
      if (first) {
        first = false;
        return;
      }
      refit();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [refit]);

  // Turn-by-turn simulation: no real GPS, so walk the resolved route at a
  // fixed demo pace, driving the heading-up follow camera and the puck
  // marker imperatively (same DOM-ref pattern as the transform loop) rather
  // than through React state every frame.
  const navRaf = useRef(null);
  useEffect(() => {
    if (!navigating || !route || route.points.length < 2) return undefined;

    const totalLen = pathLength(route.points);
    const duration = clamp(totalLen * NAV_SECONDS_PER_UNIT, 8, 45);
    const start = performance.now();

    const frame = (now) => {
      const elapsed = (now - start) / 1000;
      const t = Math.min(1, elapsed / duration);
      const { pos, heading } = sampleAlongPath(route.points, t);
      followPoint(pos, heading, NAV_SCALE, NAV_ANCHOR);
      if (puckRef.current) {
        puckRef.current.setAttribute('transform', `translate(${pos.x} ${pos.y}) rotate(${heading})`);
      }
      // The map group itself just rotated to -heading (via followPoint) by
      // writing straight to the DOM, which never re-renders React — so
      // anything billboarded against that rotation (pin labels, the compass
      // needle) has to be counter-rotated here too, every frame, or it goes
      // stale the moment navigation starts.
      for (const el of Object.values(pinBillboardRefs.current)) {
        if (el) el.setAttribute('transform', `rotate(${heading})`);
      }
      if (compassNeedleRef.current) {
        compassNeedleRef.current.setAttribute('transform', `rotate(${-heading} ${COMPASS_CENTER} ${COMPASS_CENTER})`);
      }
      if (t < 1) navRaf.current = requestAnimationFrame(frame);
      else navRaf.current = null;
    };
    navRaf.current = requestAnimationFrame(frame);

    return () => {
      if (navRaf.current != null) cancelAnimationFrame(navRaf.current);
      navRaf.current = null;
    };
  }, [navigating, route, followPoint]);

  // Leaving navigation: return to north-up and re-fit the overview.
  const wasNavigating = useRef(navigating);
  useEffect(() => {
    if (wasNavigating.current && !navigating) {
      setRotateImmediate(0);
      refit();
    }
    wasNavigating.current = navigating;
  }, [navigating, setRotateImmediate, refit]);

  useEffect(() => {
    const el = routePathRef.current;
    if (!el || !route) return;
    const length = pathLength(route.points) || 1;
    el.style.transition = 'none';
    el.style.strokeDasharray = `${length}`;
    el.style.strokeDashoffset = `${length}`;
    // eslint-disable-next-line no-unused-expressions
    el.getBoundingClientRect();
    requestAnimationFrame(() => {
      el.style.transition = 'stroke-dashoffset 900ms var(--ease-board)';
      el.style.strokeDashoffset = '0';
    });
  }, [route]);

  const dragState = useRef(null);
  const onPointerDown = useCallback((e) => {
    if (e.target.closest('[data-no-pan]')) return;
    dragState.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);
  const onPointerMove = useCallback((e) => {
    if (!dragState.current) return;
    const dx = e.clientX - dragState.current.x;
    const dy = e.clientY - dragState.current.y;
    dragState.current = { x: e.clientX, y: e.clientY };
    panBy(dx, dy);
  }, [panBy]);
  const onPointerUp = useCallback((e) => {
    dragState.current = null;
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, []);

  const onWheel = useCallback((e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    zoomBy(factor);
  }, [zoomBy]);

  const onNode = route ? new Set(route.nodeIds) : null;

  return (
    <div className="board-viewport">
      <svg
        ref={svgRef}
        className="board-svg"
        role="img"
        aria-label="Map of the RPI ARN pilot area"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onWheel={onWheel}
      >
        <g ref={groupRef} className="board-group">
          <rect x={-1200} y={-900} width={BOARD_VIEWBOX.width + 2400} height={BOARD_VIEWBOX.height + 1800} fill="var(--map-ground)" />

          {/* distant city streets — context beyond the pilot area, unnamed */}
          <g stroke="var(--map-border-strong)" strokeWidth={3} opacity={0.4}>
            {CITY_STREETS.map((d) => (
              <path key={d} d={d} fill="none" />
            ))}
          </g>

          {/* waterfront — the Approach side of campus, past EMPAC */}
          <path d={WATER_PATH} fill="var(--map-water)" />
          <path d={WATER_PATH} fill="none" stroke="var(--map-water-edge)" strokeWidth={2} opacity={0.5} />

          {/* organic parkland */}
          {PARK_BLOBS.map((d) => (
            <path key={d} d={d} fill="var(--map-quad)" />
          ))}
          <g fill="var(--map-quad-canopy)">
            {TREE_CANOPY.map((dot, i) => (
              <circle key={i} cx={dot.x} cy={dot.y} r={dot.r} />
            ))}
          </g>

          {/* walkway network */}
          <g fill="none">
            {EDGES.map((edge) => (
              <path
                key={`${edge.a}-${edge.b}-case`}
                d={edgePath(edge)}
                stroke="var(--map-path-casing)"
                strokeWidth={edge.stairs ? 7 : 9}
                strokeLinecap="round"
              />
            ))}
            {EDGES.map((edge) => (
              <path
                key={`${edge.a}-${edge.b}`}
                d={edgePath(edge)}
                stroke={edge.stairs ? 'var(--map-path-stairs)' : 'var(--map-path)'}
                strokeWidth={edge.stairs ? 3 : 4.5}
                strokeDasharray={edge.stairs ? '1 9' : undefined}
                strokeLinecap="round"
              />
            ))}
          </g>

          {/* building footprints — sit above the paths, so a walkway reads
              as leading up to the building rather than cutting through it */}
          <g className="footprints-shadow" fill="var(--map-building)">
            {BUILDINGS.map((b) => (
              <rect
                key={b.id}
                x={b.x - BUILDING_FOOTPRINT.width / 2}
                y={b.y - BUILDING_FOOTPRINT.height / 2 - 6}
                width={BUILDING_FOOTPRINT.width}
                height={BUILDING_FOOTPRINT.height}
                rx={6}
              />
            ))}
          </g>

          {/* active route */}
          {route && (
            <g className="route-shadow">
              <path d={pointsToPath(route.points)} fill="none" stroke="#ffffff" strokeWidth={9} strokeLinejoin="round" strokeLinecap="round" />
              <path
                ref={routePathRef}
                d={pointsToPath(route.points)}
                fill="none"
                stroke="var(--map-accent)"
                strokeWidth={5.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </g>
          )}

          {/* junction dots, only where the route passes through */}
          {JUNCTIONS.filter((j) => onNode?.has(j.id)).map((j) => (
            <circle key={j.id} cx={j.x} cy={j.y} r={4} fill="var(--map-accent)" stroke="#ffffff" strokeWidth={2} />
          ))}

          {/* building pins */}
          <g className="pins-shadow">
            {BUILDINGS.map((b) => {
              const kind = b.id === startId ? 'start' : b.id === endId ? 'end' : onNode?.has(b.id) ? 'transit' : 'idle';
              return (
                <Pin
                  key={b.id}
                  x={b.x}
                  y={b.y}
                  kind={kind}
                  label={b.name}
                  counterRotate={-current.rotate}
                  billboardRef={(el) => { pinBillboardRefs.current[b.id] = el; }}
                />
              );
            })}
          </g>

          {/* live position puck — drawn pointing along world heading, so
              the map's own heading-up rotation makes it point straight up */}
          {navigating && route && (
            <g ref={puckRef} className="nav-puck">
              <circle r={9} fill="var(--map-accent)" stroke="#ffffff" strokeWidth={3} />
              <path d="M0 -22 L8 -8 L0 -12 L-8 -8 Z" fill="var(--map-accent)" stroke="#ffffff" strokeWidth={1.5} strokeLinejoin="round" />
            </g>
          )}
        </g>
      </svg>

      <div className="board-hud" data-no-pan>
        <ZoomControls onZoomIn={() => zoomBy(1.25)} onZoomOut={() => zoomBy(1 / 1.25)} />
        <CompassControl ref={compassNeedleRef} rotate={current.rotate} onRotate={setRotateImmediate} />
      </div>
    </div>
  );
}
