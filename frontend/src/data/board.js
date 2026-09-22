// Real coordinates for the ARN pilot area (~0.1mi around Carnegie), looked
// up from OpenStreetMap (Nominatim). Buildings are real; the walkway
// junctions between them are still approximate placeholder waypoints (no
// surveyed sidewalk data yet), placed at sensible midpoints between the
// buildings they connect. Elevation is mock, authored to match the real
// story of this campus: EMPAC sits low near the Approach/river, the
// academic quad sits highest up the hill.

export const WALK_SPEED_MPH = 2.5; // accessible walking pace, not average 3mph

export const BUILDINGS = [
  { id: 'carnegie', name: 'Carnegie', lat: 42.7304438, lng: -73.6831941, elevation: 58 },
  { id: 'walker', name: 'Walker Lab', lat: 42.7308752, lng: -73.6825058, elevation: 60 },
  { id: 'sage', name: 'Sage Lab', lat: 42.7308930, lng: -73.6816644, elevation: 66 },
  { id: 'pittsburgh', name: 'Pittsburgh', lat: 42.7311570, lng: -73.6833192, elevation: 55 },
  { id: 'empac', name: 'EMPAC', lat: 42.7288114, lng: -73.6838551, elevation: 0 },
  { id: 'westhall', name: 'West Hall', lat: 42.7317090, lng: -73.6831067, elevation: 18 },
  { id: 'amoseaton', name: 'Amos Eaton', lat: 42.7302055, lng: -73.6825717, elevation: 42 },
  { id: 'lally', name: 'Lally', lat: 42.7300621, lng: -73.6819038, elevation: 48 },
  { id: 'library', name: 'Library', lat: 42.7294564, lng: -73.6826452, elevation: 50 },
  { id: 'vcc', name: 'VCC', lat: 42.7292341, lng: -73.6817738, elevation: 58 },
];

// Waypoints: path junctions along the walkway network, not selectable —
// placed as midpoints between the real buildings they connect.
export const JUNCTIONS = [
  { id: 'j1', lat: 42.7306021, lng: -73.6830283, elevation: 50 },
  { id: 'j2', lat: 42.7306595, lng: -73.6828500, elevation: 56 },
  { id: 'j3', lat: 42.7303341, lng: -73.6819813, elevation: 62 },
  { id: 'j4', lat: 42.7309573, lng: -73.6828392, elevation: 30 },
  { id: 'j5', lat: 42.7299501, lng: -73.6829197, elevation: 54 },
  { id: 'j6', lat: 42.7295842, lng: -73.6821076, elevation: 52 },
  { id: 'j7', lat: 42.7302602, lng: -73.6834809, elevation: 8 },
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
