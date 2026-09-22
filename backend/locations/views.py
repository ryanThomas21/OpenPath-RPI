from rest_framework.response import Response
from rest_framework.views import APIView

from .geo import haversine_meters
from .mock_data import LOCATIONS, LOCATIONS_BY_ID
from .serializers import (
    LocationSerializer,
    RouteRequestSerializer,
    RouteResponseSerializer,
)


class LocationListView(APIView):
    """GET /api/locations/ — every routable destination (building entrances)."""

    def get(self, request):
        serializer = LocationSerializer(LOCATIONS, many=True)
        return Response(serializer.data)


class RouteView(APIView):
    """POST /api/route/ — a placeholder route from origin to a destination.

    Returns a straight line between the two points rather than a real
    accessible path — enough for the frontend to build and test the
    route-drawing UI against until the node/edge graph and pathfinding
    engine exist.
    """

    def post(self, request):
        request_serializer = RouteRequestSerializer(data=request.data)
        request_serializer.is_valid(raise_exception=True)
        data = request_serializer.validated_data

        destination = LOCATIONS_BY_ID.get(data["destination_id"])
        if destination is None:
            return Response(
                {"detail": f"Unknown destination_id: {data['destination_id']!r}"},
                status=404,
            )

        origin = data["origin"]
        distance = haversine_meters(
            origin["lat"], origin["lng"], destination["lat"], destination["lng"]
        )

        response_serializer = RouteResponseSerializer(
            {
                "path": [origin, {"lat": destination["lat"], "lng": destination["lng"]}],
                "distance_meters": round(distance, 1),
                # Mock data has no accessibility attributes yet, so this
                # always reports True rather than actually filtering.
                "accessible": True,
            }
        )
        return Response(response_serializer.data)
