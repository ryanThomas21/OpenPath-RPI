from django.urls import path

from .views import LocationListView, RouteView

urlpatterns = [
    path("locations/", LocationListView.as_view(), name="locations"),
    path("route/", RouteView.as_view(), name="route"),
]
