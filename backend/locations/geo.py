"""Small geometry helpers used until real graph-based pathfinding exists."""

import math

EARTH_RADIUS_METERS = 6371000


def haversine_meters(lat1, lng1, lat2, lng2):
    """Great-circle distance in meters between two lat/lng points."""
    to_rad = math.radians

    d_lat = to_rad(lat2 - lat1)
    d_lng = to_rad(lng2 - lng1)

    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(to_rad(lat1)) * math.cos(to_rad(lat2)) * math.sin(d_lng / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return EARTH_RADIUS_METERS * c
