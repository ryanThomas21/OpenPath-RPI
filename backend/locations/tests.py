from rest_framework.test import APITestCase


class LocationListViewTests(APITestCase):
    def test_returns_all_mock_locations(self):
        response = self.client.get("/api/locations/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 10)
        self.assertIn("carnegie", [loc["id"] for loc in response.data])


class RouteViewTests(APITestCase):
    def test_returns_straight_line_route_to_known_destination(self):
        response = self.client.post(
            "/api/route/",
            {
                "origin": {"lat": 42.7296, "lng": -73.6800},
                "destination_id": "carnegie",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["path"]), 2)
        self.assertGreater(response.data["distance_meters"], 0)
        self.assertTrue(response.data["accessible"])

    def test_unknown_destination_returns_404(self):
        response = self.client.post(
            "/api/route/",
            {
                "origin": {"lat": 42.7296, "lng": -73.6800},
                "destination_id": "not-a-real-place",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 404)

    def test_missing_fields_returns_400(self):
        response = self.client.post("/api/route/", {}, format="json")
        self.assertEqual(response.status_code, 400)
