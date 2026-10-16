"""Check graph.json for data mistakes before the app or tests rely on it.

Run from backend/:  python -m locations.validate_graph [path/to/graph.json]
Exits with status 1 when any errors are found.

Errors: duplicate ids, edges pointing at missing nodes, buildings without
entrances, entrances without an accessibility flag, scenarios that reference
unknown locations, and real (non-mock) nodes cut off from campus.
Report only: intentional disconnected areas (all-mock) and locations that
can only be reached by stairs.
"""

import json
import sys
from collections import Counter
from pathlib import Path

GRAPH_PATH = Path(__file__).with_name("graph.json")
NODE_TYPES = {"location", "entrance", "path"}
EDGE_TYPES = {"path", "stairs", "construction"}
SCENARIO_EXPECTS = {"route", "no_route"}


def components(graph, skip_edge_types=()):
    """Connected groups of node ids, largest first. Edges to missing nodes are ignored."""
    neighbors = {node["id"]: set() for node in graph["nodes"]}
    for edge in graph["edges"]:
        if edge.get("type") in skip_edge_types:
            continue
        if edge.get("a") in neighbors and edge.get("b") in neighbors:
            neighbors[edge["a"]].add(edge["b"])
            neighbors[edge["b"]].add(edge["a"])

    groups, seen = [], set()
    for node_id in neighbors:
        if node_id in seen:
            continue
        group, stack = set(), [node_id]
        while stack:
            current = stack.pop()
            if current not in group:
                group.add(current)
                stack.extend(neighbors[current] - group)
        seen |= group
        groups.append(group)
    return sorted(groups, key=len, reverse=True)


def _duplicates(values):
    return sorted(value for value, count in Counter(values).items() if count > 1)


def validate(graph):
    """Return (errors, notes) as lists of human-readable strings."""
    errors, notes = [], []
    nodes = graph.get("nodes", [])
    edges = graph.get("edges", [])
    scenarios = graph.get("scenarios", [])

    node_ids = [node.get("id") for node in nodes]
    for node_id in _duplicates(node_ids):
        errors.append(f"duplicate node id: {node_id}")
    known_nodes = set(node_ids)
    mock_ids = {node["id"] for node in nodes if node.get("mock")}

    entrance_ids = []
    for node in nodes:
        if node.get("type") not in NODE_TYPES:
            errors.append(f"node {node.get('id')}: unknown type {node.get('type')!r}")
        if "lat" not in node or "lng" not in node:
            errors.append(f"node {node.get('id')}: missing lat/lng")
        if node.get("type") == "location" and not node.get("entrances"):
            errors.append(f"building {node.get('id')}: has no entrances")
        for entrance in node.get("entrances", []):
            entrance_ids.append(entrance.get("id"))
            if "accessible" not in entrance:
                errors.append(f"entrance {entrance.get('id')}: missing 'accessible' (use null if unverified)")
            elif entrance["accessible"] not in (True, False, None):
                errors.append(f"entrance {entrance.get('id')}: 'accessible' must be true, false, or null")
    for entrance_id in _duplicates(entrance_ids):
        errors.append(f"duplicate entrance id: {entrance_id}")
    for entrance_id in sorted(set(entrance_ids) & known_nodes):
        errors.append(f"entrance id {entrance_id} is also used as a node id")

    edge_keys = []
    for index, edge in enumerate(edges):
        label = f"edge #{index} ({edge.get('a')} - {edge.get('b')})"
        for end in ("a", "b"):
            if edge.get(end) not in known_nodes:
                errors.append(f"{label}: points at missing node {edge.get(end)!r}")
        if edge.get("a") == edge.get("b"):
            errors.append(f"{label}: connects a node to itself")
        if edge.get("type") not in EDGE_TYPES:
            errors.append(f"{label}: unknown type {edge.get('type')!r}")
        edge_keys.append((frozenset((edge.get("a"), edge.get("b"))), edge.get("type")))
    for pair, edge_type in _duplicates(edge_keys):
        errors.append(f"duplicate {edge_type} edge between {' and '.join(sorted(pair))}")

    locations = {node["id"]: node for node in nodes if node.get("type") in {"location", "entrance"}}
    for scenario_id in _duplicates(scenario.get("id") for scenario in scenarios):
        errors.append(f"duplicate scenario id: {scenario_id}")
    for scenario in scenarios:
        label = f"scenario {scenario.get('id')}"
        if scenario.get("expect") not in SCENARIO_EXPECTS:
            errors.append(f"{label}: expect must be 'route' or 'no_route'")
        for end in ("start", "destination"):
            location = locations.get(scenario.get(f"{end}_id"))
            if location is None:
                errors.append(f"{label}: unknown {end}_id {scenario.get(f'{end}_id')!r}")
                continue
            entrance_id = scenario.get(f"{end}_entrance_id")
            if entrance_id and entrance_id not in {item.get("id") for item in location.get("entrances", [])}:
                errors.append(f"{label}: {entrance_id!r} is not an entrance of {location['id']}")

    groups = components(graph)
    if groups:
        notes.append(f"connected areas: {len(groups)} (campus has {len(groups[0])} nodes)")
    for group in groups[1:]:
        if group <= mock_ids:
            notes.append(f"intentional disconnected area (mock): {', '.join(sorted(group))}")
        else:
            errors.append(f"unreachable from campus (not marked mock): {', '.join(sorted(group - mock_ids))}")

    if groups:
        # Routing always skips construction edges, and skips stairs when asked to avoid them.
        campus = groups[0]
        stairs_free_campus = max(
            components(graph, skip_edge_types={"stairs", "construction"}),
            key=lambda group: len(group & campus),
        )
        for node_id in sorted(campus - stairs_free_campus):
            if node_id in locations:
                kind = "mock" if node_id in mock_ids else "real"
                notes.append(f"no stairs-free route from campus ({kind}): {node_id}")

    return errors, notes


def main(argv):
    path = Path(argv[1]) if len(argv) > 1 else GRAPH_PATH
    with path.open(encoding="utf-8") as graph_file:
        graph = json.load(graph_file)

    errors, notes = validate(graph)
    entrance_count = sum(len(node.get("entrances", [])) for node in graph.get("nodes", []))
    print(
        f"Checked {path.name}: {len(graph.get('nodes', []))} nodes, {len(graph.get('edges', []))} edges, "
        f"{entrance_count} entrances, {len(graph.get('scenarios', []))} scenarios"
    )
    for note in notes:
        print(f"  - {note}")
    if errors:
        print(f"\n{len(errors)} error(s):")
        for error in errors:
            print(f"  x {error}")
        return 1
    print("\nNo errors.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
