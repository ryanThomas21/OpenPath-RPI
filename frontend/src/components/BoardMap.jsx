import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { BUILDINGS, EDGES, JUNCTIONS, NODES } from '../data/board.js';
import { pathLengthFeet, sampleAlongPathGeo } from '../utils/geo.js';
import { buildManeuvers, currentInstruction } from '../utils/navigation.js';
import InstructionBanner from './InstructionBanner.jsx';
import ZoomControls from './ZoomControls.jsx';

// Turn-by-turn camera: closer than any overview fit, puck held low so most
// of the screen shows the path ahead — Apple Maps' walking-nav framing.
// No heading-up rotation in this pass: Leaflet has no native map bearing,
// and a CSS-transform rotate hack is exactly the kind of thing that needs
// eyes-on testing to get right, which isn't available right now. This ships
// a real, working north-up follow camera instead of a rotation hack no one
// has seen render. See the chat for the trade-off and how to revisit it.
const NAV_ZOOM = 19;
const NAV_ANCHOR = { x: 0.5, y: 0.64 };
const NAV_FT_PER_SEC = 65; // demo-compressed walking pace, not real-time
const NAV_CAMERA_UPDATE_MS = 300;
const INSTRUCTION_UPDATE_MS = 150;
const OVERVIEW_PAD_FT = 60;

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Google/Apple-style teardrop marker built as a Leaflet divIcon (plain HTML,
// not React — Leaflet owns this DOM node directly).
function buildPinIcon(kind, label) {
  const fillVar =
    kind === 'start' ? 'var(--pin-start)' : kind === 'end' ? 'var(--pin-end)' : kind === 'transit' ? 'var(--pin-transit)' : 'var(--pin-idle)';
  const scale = kind === 'idle' ? 0.85 : 1;
  const pinSize = Math.round(30 * scale);
  const width = 160;
  const height = pinSize + 24;
  const html = `
    <div class="pin-icon-wrap">
      <div class="pin-label${kind !== 'idle' ? ' pin-label-active' : ''}">${escapeHtml(label)}</div>
      <svg width="${pinSize}" height="${pinSize}" viewBox="0 0 24 24" class="pin-icon-svg">
        <path d="M12 0C7.03 0 3 4.03 3 9c0 6.75 9 15 9 15s9-8.25 9-15c0-4.97-4.03-9-9-9z" fill="${fillVar}" stroke="rgba(20,30,25,0.18)" stroke-width="0.5" />
        <circle cx="12" cy="9.2" r="3.6" fill="#ffffff" />
      </svg>
    </div>`;
  return L.divIcon({ html, className: 'pin-icon-container', iconSize: [width, height], iconAnchor: [width / 2, height] });
}

const PUCK_ICON = L.divIcon({
  html: `<div class="nav-puck">
      <svg width="44" height="44" viewBox="-22 -22 44 44">
        <circle r="9" fill="var(--map-accent)" stroke="#ffffff" stroke-width="3" />
        <g class="puck-arrow">
          <path d="M0 -22 L8 -8 L0 -12 L-8 -8 Z" fill="var(--map-accent)" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round" />
        </g>
      </svg>
    </div>`,
  className: 'nav-puck-container',
  iconSize: [44, 44],
  iconAnchor: [22, 22],
});

// Bridges react-leaflet's context (only readable from inside <MapContainer>)
// back out to the parent, which needs the raw Leaflet map instance for
// project/unproject and direct zoom/pan calls.
function MapInstanceBridge({ onReady }) {
  const map = useMap();
  useEffect(() => {
    onReady(map);
  }, [map, onReady]);
  return null;
}

export default function BoardMap({ route, startId, endId, navigating, destinationName }) {
  const mapRef = useRef(null);
  const puckMarkerRef = useRef(null);
  const [instruction, setInstruction] = useState(null);

  const maneuvers = useMemo(() => (route ? buildManeuvers(route.points) : []), [route]);
  const onNode = route ? new Set(route.nodeIds) : null;

  const handleMapReady = useCallback((map) => {
    mapRef.current = map;
  }, []);

  // Fit the whole pilot area on mount, and fit the resolved route whenever
  // it changes — Leaflet's own fitBounds does the padding/easing natively,
  // so the manual safe-rect math the old SVG board needed isn't needed here.
  const fitOverview = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const points = route ? route.points : BUILDINGS;
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
    const mobile = map.getSize().x <= 640;
    map.fitBounds(bounds, {
      paddingTopLeft: mobile ? [16, 16] : [356, 16],
      paddingBottomRight: mobile ? [76, 260] : [96, 16],
      animate: true,
    });
  }, [route]);

  useEffect(() => {
    if (!navigating) fitOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, navigating]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;
    const handle = () => {
      if (!navigating) fitOverview();
    };
    map.on('resize', handle);
    return () => map.off('resize', handle);
  }, [fitOverview, navigating]);

  // Turn-by-turn simulation: no real GPS, so walk the resolved route at a
  // fixed demo pace, driving the follow camera, the puck, and the
  // instruction countdown.
  const navRaf = useRef(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!navigating || !route || !map || route.points.length < 2) return undefined;

    const totalLen = pathLengthFeet(route.points);
    const duration = Math.min(45, Math.max(8, totalLen / NAV_FT_PER_SEC));
    const start = performance.now();
    let lastCameraAt = 0;
    let lastInstructionAt = 0;

    const frame = (now) => {
      const elapsed = (now - start) / 1000;
      const t = Math.min(1, elapsed / duration);
      const { pos, heading } = sampleAlongPathGeo(route.points, t);

      if (puckMarkerRef.current) {
        puckMarkerRef.current.setLatLng([pos.lat, pos.lng]);
        const el = puckMarkerRef.current.getElement();
        const arrow = el?.querySelector('.puck-arrow');
        if (arrow) arrow.setAttribute('transform', `rotate(${heading})`);
      }

      if (now - lastCameraAt >= NAV_CAMERA_UPDATE_MS || t >= 1) {
        lastCameraAt = now;
        const size = map.getSize();
        const zoom = NAV_ZOOM;
        const puckPoint = map.project([pos.lat, pos.lng], zoom);
        // Anchor the puck low on screen (NAV_ANCHOR) instead of dead
        // center: setView always centers its target, so we instead center
        // a "virtual" point offset from the puck by exactly the pixel gap
        // between the viewport's true center and the anchor we want.
        const dx = size.x / 2 - size.x * NAV_ANCHOR.x;
        const dy = size.y / 2 - size.y * NAV_ANCHOR.y;
        const virtualCenter = map.unproject(puckPoint.subtract([dx, dy]), zoom);
        map.setView(virtualCenter, zoom, { animate: true, duration: (NAV_CAMERA_UPDATE_MS / 1000) * 1.15 });
      }

      if (now - lastInstructionAt >= INSTRUCTION_UPDATE_MS || t >= 1) {
        lastInstructionAt = now;
        const traveledFt = t * totalLen;
        setInstruction(currentInstruction(maneuvers, traveledFt));
      }

      if (t < 1) navRaf.current = requestAnimationFrame(frame);
      else navRaf.current = null;
    };
    navRaf.current = requestAnimationFrame(frame);

    return () => {
      if (navRaf.current != null) cancelAnimationFrame(navRaf.current);
      navRaf.current = null;
      setInstruction(null);
    };
  }, [navigating, route, maneuvers]);

  // Leaving navigation: re-fit the overview.
  const wasNavigating = useRef(navigating);
  useEffect(() => {
    if (wasNavigating.current && !navigating) fitOverview();
    wasNavigating.current = navigating;
  }, [navigating, fitOverview]);

  const initialCenter = [NODES.carnegie.lat, NODES.carnegie.lng];

  return (
    <div className="board-viewport">
      <MapContainer
        center={initialCenter}
        zoom={17}
        zoomControl={false}
        attributionControl={true}
        className="board-map"
      >
        <MapInstanceBridge onReady={handleMapReady} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={20}
        />

        {/* idle walkway network */}
        {EDGES.map((edge) => (
          <Polyline
            key={`${edge.a}-${edge.b}`}
            positions={[
              [NODES[edge.a].lat, NODES[edge.a].lng],
              [NODES[edge.b].lat, NODES[edge.b].lng],
            ]}
            pathOptions={{
              color: edge.stairs ? 'var(--map-path-stairs)' : 'var(--map-accent)',
              weight: edge.stairs ? 3 : 4,
              opacity: edge.stairs ? 0.55 : 0.35,
              dashArray: edge.stairs ? '1 9' : undefined,
              lineCap: 'round',
            }}
          />
        ))}

        {/* active route */}
        {route && (
          <>
            <Polyline
              positions={route.points.map((p) => [p.lat, p.lng])}
              pathOptions={{ color: '#ffffff', weight: 9, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }}
            />
            <Polyline
              positions={route.points.map((p) => [p.lat, p.lng])}
              pathOptions={{ color: 'var(--map-accent)', weight: 5.5, lineCap: 'round', lineJoin: 'round' }}
            />
          </>
        )}

        {/* junction dots, only where the route passes through */}
        {JUNCTIONS.filter((j) => onNode?.has(j.id)).map((j) => (
          <Marker
            key={j.id}
            position={[j.lat, j.lng]}
            icon={L.divIcon({
              html: '<div class="junction-dot"></div>',
              className: 'junction-dot-container',
              iconSize: [10, 10],
              iconAnchor: [5, 5],
            })}
            interactive={false}
          />
        ))}

        {/* building pins */}
        {BUILDINGS.map((b) => {
          const kind = b.id === startId ? 'start' : b.id === endId ? 'end' : onNode?.has(b.id) ? 'transit' : 'idle';
          return <Marker key={b.id} position={[b.lat, b.lng]} icon={buildPinIcon(kind, b.name)} interactive={false} />;
        })}

        {navigating && route && <Marker ref={puckMarkerRef} position={[route.points[0].lat, route.points[0].lng]} icon={PUCK_ICON} interactive={false} />}
      </MapContainer>

      {navigating && <InstructionBanner instruction={instruction} destinationName={destinationName} />}

      <div className="board-hud" data-no-pan>
        <ZoomControls onZoomIn={() => mapRef.current?.zoomIn()} onZoomOut={() => mapRef.current?.zoomOut()} />
      </div>
    </div>
  );
}
