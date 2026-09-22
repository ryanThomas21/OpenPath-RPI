import { FEET_PER_UNIT, NODES, WALK_SPEED_MPH } from '../data/board.js';
import { pathLength } from './geometry.js';

// A route is "steep" once its average grade crosses the ADA's own gentle-
// ramp threshold (1:20, 5%) — a physically meaningful cutoff for this
// product rather than an arbitrary number.
const STEEP_GRADE = 0.05;

// Distance, elevation, and time for a resolved route. Elevation and the
// world-to-feet scale are placeholder data (see board.js); the shape of
// this summary is what a real routing/elevation source would fill later.
export function summarizeRoute(route) {
  const distanceFt = pathLength(route.points) * FEET_PER_UNIT;

  let gainFt = 0;
  let lossFt = 0;
  for (let i = 1; i < route.nodeIds.length; i += 1) {
    const delta = NODES[route.nodeIds[i]].elevation - NODES[route.nodeIds[i - 1]].elevation;
    if (delta > 0) gainFt += delta;
    else lossFt += -delta;
  }

  const minutes = Math.max(1, Math.round(distanceFt / 5280 / WALK_SPEED_MPH * 60));
  const grade = distanceFt > 0 ? gainFt / distanceFt : 0;
  const steepness = gainFt > 0 && grade >= STEEP_GRADE ? 'steep' : 'flat';

  return { distanceFt, elevationGainFt: gainFt, elevationLossFt: lossFt, minutes, steepness };
}

export function formatDistance(feet) {
  if (feet < 528) return `${Math.round(feet)} ft`;
  return `${(feet / 5280).toFixed(1)} mi`;
}

export function formatMinutes(minutes) {
  return `${minutes} min`;
}
