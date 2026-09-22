// Decorative map layers: organic parkland, a tree canopy texture, distant
// city streets, a waterfront edge (RPI's real campus sits above the Hudson,
// with EMPAC down near the Approach — this grounds the placeholder board in
// that geography), and building footprints. All static, hand-authored or
// seeded — nothing here changes at runtime, so it costs nothing per frame.

function mulberry32(seed) {
  let a = seed;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function scatterDots(seed, count, cx, cy, rx, ry) {
  const rng = mulberry32(seed);
  const dots = [];
  let guard = 0;
  while (dots.length < count && guard < count * 20) {
    guard += 1;
    const x = cx + (rng() * 2 - 1) * rx;
    const y = cy + (rng() * 2 - 1) * ry;
    const nx = (x - cx) / rx;
    const ny = (y - cy) / ry;
    if (nx * nx + ny * ny > 1) continue;
    dots.push({ x, y, r: 2 + rng() * 2.6 });
  }
  return dots;
}

// Two organic lawns, replacing the old flat ellipses — same rough footprint
// as the original quad tint, but with an irregular, hand-drawn edge.
export const PARK_BLOBS = [
  'M300 480 C260 380 340 260 480 240 C620 220 780 210 900 280 C1000 340 1020 460 960 540 C900 620 760 680 600 670 C460 660 340 620 300 480 Z',
  'M180 620 C150 560 190 480 270 470 C360 460 440 500 460 580 C480 660 430 730 340 745 C250 758 180 700 180 620 Z',
];

export const TREE_CANOPY = [
  ...scatterDots(1001, 70, 620, 460, 340, 200),
  ...scatterDots(1002, 26, 310, 610, 150, 120),
];

// A wavy waterfront band along the south edge — the Approach/Hudson side
// of campus, past EMPAC.
export const WATER_PATH =
  'M-300 780 C-100 740 100 760 300 730 C500 700 700 750 900 720 C1100 690 1300 730 1500 700 L1500 1000 L-300 1000 Z';

// Distant city streets outside the pilot area, giving the board a sense of
// place without inventing named roads.
export const CITY_STREETS = [
  'M-300 260 L1500 190',
  'M170 -300 L260 1200',
  'M960 -300 L1040 1200',
  'M-300 40 L1500 120',
];

export const BUILDING_FOOTPRINT = { width: 64, height: 40 };
