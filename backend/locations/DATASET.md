# Campus map dataset

`backend/locations/graph.json` is the shared mock map of the ARN (0.1 mi around
Carnegie). Django serves it to the whole app: `GET /api/map/` returns the
whole file, `GET /api/locations/` returns the buildings, and `POST /api/route/`
routes over it. Coordinates and accessibility are provisional. Nothing here
has been surveyed on site.

## Format

```jsonc
{
  "nodes": [
    // A building you can route to
    { "id": "walker", "name": "Walker Lab", "lat": 42.73, "lng": -73.68, "elevation": 60,
      "type": "location",
      "entrances": [
        { "id": "walker-e2", "lat": 42.73, "lng": -73.68, "label": "East (Accessible)",
          "accessible": true }   // true | false | null (null = not verified, never assume accessible)
      ] },
    // A walkway point between buildings
    { "id": "j1", "lat": 42.73, "lng": -73.68, "elevation": 50, "type": "path" }
  ],
  "edges": [
    { "a": "carnegie", "b": "j1", "type": "path" }   // type: path | stairs | construction
  ],
  "scenarios": [ /* labeled test cases, see below */ ]
}
```

- Edges go both ways. Their length is the straight-line distance between the
  two nodes unless an edge has a `dist`.
- `stairs` edges are skipped when the user asks to avoid stairs.
  `construction` edges are always skipped.
- Every building needs at least one entrance, and every entrance needs
  `accessible`.
- Anything tagged `"mock": true`, with a name starting with "Mock:", exists
  only for testing. It is not a real place.
- Routing does **not** read `accessible` yet. Choosing an entrance only moves
  the route's endpoint to it.

## Test scenarios

Each row is an entry in `graph.json`'s `scenarios` list, which is the source of
truth. `DatasetScenarioTests` runs every one through `POST /api/route/`.

| Scenario id | Case | Try this | Expected |
|---|---|---|---|
| `stairs-shortcut` | stairs | Carnegie → Library, stairs allowed | Route uses the Carnegie–Library stairs |
| `stairs-avoided` | stairs | Carnegie → Library, avoid stairs | Route detours via j5, no stairs |
| `multi-entrance-endpoints` | multiple entrances | Carnegie (Southeast, `carnegie-e2`) → EMPAC (North, `empac-e4`) | Route starts and ends at those entrances |
| `accessible-entrance` | accessible entrance | Carnegie → Walker Lab's East (Accessible) entrance, avoid stairs | Route found, no stairs |
| `unreachable-annex` | disconnected area | Carnegie → Mock: Unreachable Annex | 404 "No available route connects these locations." |
| `overlook-by-stairs` | stairs | Carnegie → Mock: Stairs-only Overlook, stairs allowed | Route via j5 → j6, uses stairs |
| `no-accessible-route` | no accessible route | Carnegie → Mock: Stairs-only Overlook's North (accessible) entrance, avoid stairs | 404 "No available route connects these locations." |

The mock buildings also cover:
- **Unreachable Annex:** its only entrance is accessible, but nothing connects
  to it.
- **Stairs-only Overlook:** it has one inaccessible entrance (West) and one
  accessible entrance (North). Stairs are the only way in.

## Checking the data

From `backend/` with the virtual environment active:

```sh
python -m locations.validate_graph      # exits 1 and lists problems if any
python manage.py test locations locations.conceptual_tests
```

The validator checks for duplicate ids, edges that point at missing nodes,
buildings without entrances, missing `accessible` flags, and scenarios that
name unknown places. It fails if a real building is cut off from campus. It
reports intentional mock disconnected areas and stairs-only locations without
failing.

## Other data files

| File | What it is |
|---|---|
| `practice_data/CGLocations.json`, `CGPaths.json` | Nat's practice graph (nodes A–Z, construction blocks) for `conceptual_tests.py`. Kept separate on purpose. It uses `long` and node names instead of `lng` and ids. |
| `mock_data.py` | Older list of the same 10 buildings. Nothing imports it, and its coordinates and ids don't match `graph.json` (e.g. `west-hall` vs `westhall`). Use `graph.json`. |
| `data/ATLAS_Graph_Data.xlsx` (repo root) | Real ATLAS source data: 448 points, 584 connections, unverified accessibility labels. Not imported yet. |
