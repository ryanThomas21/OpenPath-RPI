import { NODES, EDGES } from '../data/board.js';
import { summarizeRoute } from './metrics.js';

function buildAdjacency(allowStairs) {
  const adj = new Map();
  for (const node of Object.keys(NODES)) adj.set(node, []);
  for (const edge of EDGES) {
    if (edge.stairs && !allowStairs) continue;
    const a = NODES[edge.a];
    const b = NODES[edge.b];
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    adj.get(edge.a).push({ to: edge.b, dist, edge });
    adj.get(edge.b).push({ to: edge.a, dist, edge });
  }
  return adj;
}

// Small graph, plain O(n^2) Dijkstra — no library needed.
function dijkstra(startId, endId, allowStairs) {
  const adj = buildAdjacency(allowStairs);
  const dist = new Map();
  const prev = new Map();
  const visited = new Set();
  for (const node of Object.keys(NODES)) dist.set(node, Infinity);
  dist.set(startId, 0);

  while (visited.size < dist.size) {
    let current = null;
    let currentDist = Infinity;
    for (const [node, d] of dist) {
      if (!visited.has(node) && d < currentDist) {
        current = node;
        currentDist = d;
      }
    }
    if (current === null) break;
    if (current === endId) break;
    visited.add(current);

    for (const { to, dist: edgeDist, edge } of adj.get(current)) {
      if (visited.has(to)) continue;
      const alt = currentDist + edgeDist;
      if (alt < dist.get(to)) {
        dist.set(to, alt);
        prev.set(to, { node: current, edge });
      }
    }
  }

  if (!prev.has(endId) && startId !== endId) return null;

  const path = [endId];
  const edgesUsed = [];
  let cursor = endId;
  while (cursor !== startId) {
    const step = prev.get(cursor);
    if (!step) return null;
    edgesUsed.unshift(step.edge);
    cursor = step.node;
    path.unshift(cursor);
  }
  return { nodeIds: path, edges: edgesUsed };
}

// Resolves a shortest node path into a walkway polyline (straight segments
// between real node positions — a map route line, not a schematic trace).
export function findRoute(startId, endId, allowStairs) {
  if (!startId || !endId || startId === endId) return null;
  const result = dijkstra(startId, endId, allowStairs);
  if (!result) return null;

  const route = {
    nodeIds: result.nodeIds,
    usedStairs: result.edges.some((e) => e.stairs),
    points: result.nodeIds.map((id) => NODES[id]),
  };
  return { ...route, ...summarizeRoute(route) };
}
