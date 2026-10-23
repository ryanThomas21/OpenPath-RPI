"""Fill in each edge's distance and gradient from its endpoints in locations.json.

Run from backend/:  python -m locations.edge_calculator path/to/locations.json path/to/paths.json
Rewrites paths.json in place and prints each edge it measured.

Distance is the straight-line distance in meters and is only filled in when
it is missing, so a hand-measured distance for a curved path is kept.
Gradient is always recalculated: degrees of slope going from `from` to `to`
(positive is uphill). Edges name buildings by their id, so a building end
uses whichever of its entrances is closest to the other end.
Everything else (paved, stairs, ramp, closed) is left for a person to set.
"""

import json
import math
import sys
from pathlib import Path

from .geo import haversine_meters


def _endpoints(locations, node_id):
    """(lat, lng, elevation) points an edge can attach to for this id."""
    if node_id not in locations:
        raise KeyError(f"unknown node id {node_id!r}")
    node = locations[node_id]
    points = node.get("entrances", [node])
    return [(*point["coordinates"], point["elevation"]) for point in points]


def measure_edge(locations, from_id, to_id):
    """Return (distance in meters, gradient in degrees) between two node ids."""
    distance, start, end = min(
        (haversine_meters(a[0], a[1], b[0], b[1]), a, b)
        for a in _endpoints(locations, from_id)
        for b in _endpoints(locations, to_id)
    )
    rise = end[2] - start[2]
    gradient = math.degrees(math.atan2(rise, distance)) if distance else 0.0
    return distance, gradient


def fill_paths(locations, paths):
    """Fill in distance and gradient on every edge. Returns {edge_id: problem}."""
    problems = {}
    for edge_id, edge in paths.items():
        try:
            distance, gradient = measure_edge(locations, edge["from"], edge["to"])
        except KeyError as error:
            problems[edge_id] = error.args[0]
            continue
        if not isinstance(edge.get("distance"), (int, float)):
            edge["distance"] = round(distance, 2)
        edge.setdefault("features", {})["gradient"] = round(gradient, 2)
    return problems


def main(argv):
    if len(argv) != 3:
        print("Usage: python -m locations.edge_calculator locations.json paths.json")
        return 1
    locations_path, paths_path = Path(argv[1]), Path(argv[2])
    with locations_path.open(encoding="utf-8") as locations_file:
        locations = json.load(locations_file)
    with paths_path.open(encoding="utf-8") as paths_file:
        paths = json.load(paths_file)

    problems = fill_paths(locations, paths)
    with paths_path.open("w", encoding="utf-8") as paths_file:
        json.dump(paths, paths_file, indent=4, ensure_ascii=False)
        paths_file.write("\n")

    for edge_id, edge in paths.items():
        if edge_id not in problems:
            print(f"  {edge_id}: {edge['from']} -> {edge['to']}  "
                  f"{edge['distance']} m, {edge['features']['gradient']} deg")
    if problems:
        print(f"\n{len(problems)} problem(s):")
        for edge_id, problem in problems.items():
            print(f"  x {edge_id}: {problem}")
        return 1
    print(f"\nMeasured {len(paths) - len(problems)} edge(s) in {paths_path.name}.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
