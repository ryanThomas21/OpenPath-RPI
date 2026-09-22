// Real-world geodesy for lat/lng coordinates — replaces the synthetic x/y
// board math now that the map is real OpenStreetMap tiles. At campus scale
// (a few hundred feet) a proper spherical formula and a flat-earth one are
// visually indistinguishable, but since we now have real coordinates it
// costs nothing to use the correct ones.

const EARTH_RADIUS_FT = 20902231;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

export function haversineFeet(a, b) {
  const p1 = toRad(a.lat);
  const p2 = toRad(b.lat);
  const dPhi = toRad(b.lat - a.lat);
  const dLambda = toRad(b.lng - a.lng);
  const h = Math.sin(dPhi / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dLambda / 2) ** 2;
  return 2 * EARTH_RADIUS_FT * Math.asin(Math.sqrt(h));
}

// Initial great-circle bearing from a to b, compass convention (0 = north).
export function bearingGeo(a, b) {
  const p1 = toRad(a.lat);
  const p2 = toRad(b.lat);
  const dLambda = toRad(b.lng - a.lng);
  const y = Math.sin(dLambda) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dLambda);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// Linear interpolation between two lat/lngs — a fine approximation of the
// great-circle path at the sub-quarter-mile distances this app covers.
function lerpLatLng(a, b, frac) {
  return { lat: a.lat + (b.lat - a.lat) * frac, lng: a.lng + (b.lng - a.lng) * frac };
}

export function pathLengthFeet(points) {
  let len = 0;
  for (let i = 1; i < points.length; i += 1) len += haversineFeet(points[i - 1], points[i]);
  return len;
}

// Walks a lat/lng polyline by total-length fraction t (0..1), returning the
// interpolated position and the compass bearing of the segment it's on.
export function sampleAlongPathGeo(points, t) {
  if (points.length < 2) return { pos: points[0] ?? { lat: 0, lng: 0 }, heading: 0 };
  const segLens = [];
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const len = haversineFeet(points[i - 1], points[i]);
    segLens.push(len);
    total += len;
  }
  let target = Math.min(Math.max(t, 0), 1) * total;
  for (let i = 0; i < segLens.length; i += 1) {
    const len = segLens[i];
    if (target <= len || i === segLens.length - 1) {
      const a = points[i];
      const b = points[i + 1];
      const frac = len > 0 ? Math.min(Math.max(target / len, 0), 1) : 0;
      return { pos: lerpLatLng(a, b, frac), heading: bearingGeo(a, b) };
    }
    target -= len;
  }
  return { pos: points[points.length - 1], heading: 0 };
}

export function boundsOfLatLng(points, padFt = 0) {
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  // Pad by a feet amount converted to degrees at this latitude.
  const midLat = (minLat + maxLat) / 2;
  const latPad = padFt / 364000; // ~364,000 ft per degree latitude
  const lngPad = padFt / (364000 * Math.cos(toRad(midLat)));
  return [
    [minLat - latPad, minLng - lngPad],
    [maxLat + latPad, maxLng + lngPad],
  ];
}
