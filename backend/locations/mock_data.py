"""Placeholder location data for the ARN (0.1mi radius around Carnegie).

Coordinates here are approximate, not surveyed — this exists so the API and
frontend have something real to talk to before the actual node/edge schema
and campus survey data are finalized. Swap for DB-backed data once that
lands.
"""

LOCATIONS = [
    {"id": "carnegie", "name": "Carnegie Building", "lat": 42.72960, "lng": -73.67930},
    {"id": "walker", "name": "Walker Lab", "lat": 42.72985, "lng": -73.68010},
    {"id": "sage", "name": "Sage Lab", "lat": 42.72940, "lng": -73.67865},
    {"id": "pittsburgh", "name": "Pittsburgh Building", "lat": 42.73015, "lng": -73.67875},
    {"id": "empac", "name": "EMPAC", "lat": 42.72870, "lng": -73.68160},
    {"id": "west-hall", "name": "West Hall", "lat": 42.73050, "lng": -73.68050},
    {"id": "amos-eaton", "name": "Amos Eaton", "lat": 42.72920, "lng": -73.68050},
    {"id": "lally", "name": "Lally Hall", "lat": 42.73000, "lng": -73.67790},
    {"id": "library", "name": "Folsom Library", "lat": 42.72995, "lng": -73.67940},
    {"id": "vcc", "name": "Rensselaer Union (VCC)", "lat": 42.72950, "lng": -73.68000},
]

LOCATIONS_BY_ID = {loc["id"]: loc for loc in LOCATIONS}
