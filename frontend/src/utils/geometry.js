// Wraps an angle to (-180, 180] — the "which way did we turn" range.
export function normalizeAngle(deg) {
  let a = deg % 360;
  if (a > 180) a -= 360;
  if (a <= -180) a += 360;
  return a;
}
