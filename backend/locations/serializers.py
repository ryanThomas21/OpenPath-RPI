from rest_framework import serializers


class LocationSerializer(serializers.Serializer):
    id = serializers.CharField()
    name = serializers.CharField()
    lat = serializers.FloatField()
    lng = serializers.FloatField()


class PointSerializer(serializers.Serializer):
    lat = serializers.FloatField()
    lng = serializers.FloatField()


class RouteRequestSerializer(serializers.Serializer):
    origin = PointSerializer()
    destination_id = serializers.CharField()
    accessible = serializers.BooleanField(required=False, default=False)


class RouteResponseSerializer(serializers.Serializer):
    path = PointSerializer(many=True)
    distance_meters = serializers.FloatField()
    accessible = serializers.BooleanField()
