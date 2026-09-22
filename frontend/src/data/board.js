// Placeholder geography for the ARN pilot area (~0.1mi around Carnegie).
// Coordinates are an approximate, organic campus layout — not surveyed GPS —
// arranged to read as a legible uphill walk from EMPAC (low, near the
// Approach) up through the academic quad to the upper-campus buildings.
// Swap for real geodata when it exists.

export const BOARD_VIEWBOX = { width: 1200, height: 900 };
export const BOARD_PIVOT = { x: 600, y: 450 };

// Placeholder real-world scale: the ARN pilot's ~0.1mi (528ft) radius maps
// onto the board's world units, so distance/time readouts are plausible
// rather than raw schematic numbers. Swap alongside real geodata later.
export const FEET_PER_UNIT = 1.2;
export const WALK_SPEED_MPH = 2.5; // accessible walking pace, not average 3mph

// Elevation is mock, authored to match the "uphill from EMPAC" story:
// EMPAC sits low near the Approach, the academic quad sits highest.
export const BUILDINGS = [
  { id: 'carnegie', name: 'Carnegie', x: 600, y: 430, elevation: 58 },
  { id: 'walker', name: 'Walker Lab', x: 740, y: 390, elevation: 60 },
  { id: 'sage', name: 'Sage Lab', x: 860, y: 330, elevation: 66 },
  { id: 'pittsburgh', name: 'Pittsburgh', x: 470, y: 360, elevation: 55 },
  { id: 'empac', name: 'EMPAC', x: 260, y: 660, elevation: 0 },
  { id: 'westhall', name: 'West Hall', x: 370, y: 560, elevation: 18 },
  { id: 'amoseaton', name: 'Amos Eaton', x: 430, y: 480, elevation: 42 },
  { id: 'lally', name: 'Lally', x: 790, y: 580, elevation: 48 },
  { id: 'library', name: 'Library', x: 630, y: 540, elevation: 50 },
  { id: 'vcc', name: 'VCC', x: 900, y: 470, elevation: 58 },
];

// Waypoints: path junctions along the walkway network, not selectable.
export const JUNCTIONS = [
  { id: 'j1', x: 520, y: 410, elevation: 50 },
  { id: 'j2', x: 660, y: 420, elevation: 56 },
  { id: 'j3', x: 800, y: 400, elevation: 62 },
  { id: 'j4', x: 400, y: 500, elevation: 30 },
  { id: 'j5', x: 560, y: 490, elevation: 54 },
  { id: 'j6', x: 720, y: 510, elevation: 52 },
  { id: 'j7', x: 330, y: 580, elevation: 8 },
];

const NODE_LIST = [...BUILDINGS, ...JUNCTIONS];
export const NODES = Object.fromEntries(NODE_LIST.map((n) => [n.id, n]));

export const EDGES = [
  // accessible backbone — always usable when stairs are excluded
  { a: 'carnegie', b: 'j1', stairs: false },
  { a: 'carnegie', b: 'j2', stairs: false },
  { a: 'carnegie', b: 'j5', stairs: false },
  { a: 'pittsburgh', b: 'j1', stairs: false },
  { a: 'amoseaton', b: 'j1', stairs: false },
  { a: 'amoseaton', b: 'j4', stairs: false },
  { a: 'westhall', b: 'j4', stairs: false },
  { a: 'westhall', b: 'j7', stairs: false },
  { a: 'empac', b: 'j7', stairs: false },
  { a: 'walker', b: 'j2', stairs: false },
  { a: 'walker', b: 'j3', stairs: false },
  { a: 'sage', b: 'j3', stairs: false },
  { a: 'vcc', b: 'j3', stairs: false },
  { a: 'vcc', b: 'j6', stairs: false },
  { a: 'library', b: 'j5', stairs: false },
  { a: 'library', b: 'j6', stairs: false },
  { a: 'lally', b: 'j6', stairs: false },
  { a: 'j1', b: 'j2', stairs: false },
  { a: 'j1', b: 'j4', stairs: false },
  { a: 'j2', b: 'j3', stairs: false },
  { a: 'j2', b: 'j5', stairs: false },
  { a: 'j4', b: 'j7', stairs: false },
  { a: 'j5', b: 'j6', stairs: false },
  { a: 'j3', b: 'j6', stairs: false },

  // stairs shortcuts — shorter, but excluded when the toggle is off
  { a: 'carnegie', b: 'library', stairs: true },
  { a: 'walker', b: 'amoseaton', stairs: true },
  { a: 'pittsburgh', b: 'westhall', stairs: true },
  { a: 'sage', b: 'vcc', stairs: true },
  { a: 'lally', b: 'vcc', stairs: true },
  { a: 'empac', b: 'library', stairs: true },
];
