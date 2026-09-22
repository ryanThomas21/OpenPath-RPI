export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

export function rotateAroundPivot(point, pivot, degrees) {
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = point.x - pivot.x;
  const dy = point.y - pivot.y;
  return {
    x: dx * cos - dy * sin + pivot.x,
    y: dx * sin + dy * cos + pivot.y,
  };
}

export function pointsToPath(points) {
  if (!points.length) return '';
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ');
}

export function pathLength(points) {
  let len = 0;
  for (let i = 1; i < points.length; i += 1) {
    len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return len;
}

// Compass-style bearing (0 = up/"north", 90 = right/"east") of a vector,
// matching the convention CompassControl's drag math already uses.
export function bearingOf(dx, dy) {
  return (Math.atan2(dy, dx) * 180) / Math.PI + 90;
}

// Walks a polyline by total-length fraction t (0..1), returning the
// interpolated position and the compass bearing of the segment it's on —
// the position/heading pair a turn-by-turn camera follows.
export function sampleAlongPath(points, t) {
  if (points.length < 2) return { pos: points[0] ?? { x: 0, y: 0 }, heading: 0 };
  const segLens = [];
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    const len = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    segLens.push(len);
    total += len;
  }
  let target = clamp(t, 0, 1) * total;
  for (let i = 0; i < segLens.length; i += 1) {
    const len = segLens[i];
    if (target <= len || i === segLens.length - 1) {
      const a = points[i];
      const b = points[i + 1];
      const frac = len > 0 ? clamp(target / len, 0, 1) : 0;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      return {
        pos: { x: a.x + dx * frac, y: a.y + dy * frac },
        heading: bearingOf(dx, dy),
      };
    }
    target -= len;
  }
  return { pos: points[points.length - 1], heading: 0 };
}

export function boundsOf(points, pad = 0) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs) - pad;
  const maxX = Math.max(...xs) + pad;
  const minY = Math.min(...ys) - pad;
  const maxY = Math.max(...ys) + pad;
  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    center: { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
  };
}
