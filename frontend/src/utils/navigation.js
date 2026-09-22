import { normalizeAngle } from './geometry.js';
import { bearingGeo, haversineFeet } from './geo.js';

// Below this bend angle, a vertex reads as the path just easing around a
// curve, not a maneuver a walker needs to be told about. Above it, the turn
// is graded by how sharp the actual bend is — the same tiers real turn-by-
// turn nav uses (slight / ordinary / sharp) — rather than a flat left/right.
const TURN_THRESHOLD_DEG = 20;
const SLIGHT_MAX_DEG = 45;
const SHARP_MIN_DEG = 135;

function magnitudeOf(absDelta) {
  if (absDelta < SLIGHT_MAX_DEG) return 'slight';
  if (absDelta >= SHARP_MIN_DEG) return 'sharp';
  return null;
}

// Turns the resolved route's own polyline into a maneuver list: every real
// bend, in order, plus a final arrival step — each stamped with its
// distance in feet from the start of the route.
export function buildManeuvers(points) {
  const distanceAt = [0];
  for (let i = 1; i < points.length; i += 1) {
    distanceAt.push(distanceAt[i - 1] + haversineFeet(points[i - 1], points[i]));
  }

  const steps = [];
  for (let i = 1; i < points.length - 1; i += 1) {
    const inHeading = bearingGeo(points[i - 1], points[i]);
    const outHeading = bearingGeo(points[i], points[i + 1]);
    const delta = normalizeAngle(outHeading - inHeading);
    const absDelta = Math.abs(delta);
    if (absDelta >= TURN_THRESHOLD_DEG) {
      steps.push({
        type: 'turn',
        direction: delta > 0 ? 'right' : 'left',
        magnitude: magnitudeOf(absDelta),
        atDistance: distanceAt[i],
      });
    }
  }
  steps.push({ type: 'arrive', atDistance: distanceAt[distanceAt.length - 1] });
  return steps;
}

// The maneuver the walker is currently approaching, and how far off it is.
// Once traveled distance reaches the last step (arrival), keeps reporting
// it at remaining 0 rather than disappearing right at the destination.
export function currentInstruction(steps, traveledDistance) {
  if (!steps.length) return null;
  const next = steps.find((s) => s.atDistance > traveledDistance + 0.01) ?? steps[steps.length - 1];
  return { ...next, remaining: Math.max(0, next.atDistance - traveledDistance) };
}
