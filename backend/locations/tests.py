from rest_framework.test import APITestCase

from .graph import get_graph, get_locations


class MapGraphViewTests(APITestCase):
    def test_returns_nodes_and_typed_edges(self):
        response = self.client.get("/api/map/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["nodes"]), len(get_graph()["nodes"]))
        self.assertTrue(any(node["type"] == "path" for node in response.data["nodes"]))
        self.assertTrue(all("type" in edge for edge in response.data["edges"]))


class LocationListViewTests(APITestCase):
    def test_returns_selectable_graph_locations(self):
        response = self.client.get("/api/locations/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), len(get_locations()))
        self.assertTrue(all("entrances" in location for location in response.data))


class RouteViewTests(APITestCase):
    def test_returns_graph_route_and_summary(self):
        response = self.client.post(
            "/api/route/",
            {"start_id": "carnegie", "destination_id": "walker"},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["nodeIds"][0], "carnegie")
        self.assertEqual(response.data["nodeIds"][-1], "walker")
        self.assertEqual(len(response.data["points"]), len(response.data["nodeIds"]))
        self.assertEqual(response.data["route_points"], response.data["points"])
        self.assertGreater(response.data["total_distance_m"], 0)
        self.assertEqual(response.data["maneuvers"][-1]["type"], "arrive")
        self.assertGreater(response.data["distanceFt"], 0)
        self.assertIn("minutes", response.data)

    def test_avoid_stairs_excludes_stair_edges(self):
        response = self.client.post(
            "/api/route/",
            {"start_id": "carnegie", "destination_id": "library", "avoid_stairs": True},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["usedStairs"])

    def test_stairs_are_available_when_not_excluded(self):
        response = self.client.post(
            "/api/route/",
            {"start_id": "carnegie", "destination_id": "library", "avoid_stairs": False},
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["usedStairs"])

    def test_entrance_selection_adjusts_route_endpoints(self):
        response = self.client.post(
            "/api/route/",
            {
                "start_id": "carnegie",
                "destination_id": "walker",
                "start_entrance_id": "carnegie-e2",
                "destination_entrance_id": "walker-e2",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["points"][0]["lng"], -73.6830758)
        self.assertEqual(response.data["points"][-1]["lng"], -73.6821182)

    def test_unknown_destination_returns_404(self):
        response = self.client.post(
            "/api/route/",
            {"start_id": "carnegie", "destination_id": "not-a-real-place"},
            format="json",
        )
        self.assertEqual(response.status_code, 404)

    def test_missing_fields_returns_400(self):
        response = self.client.post("/api/route/", {}, format="json")
        self.assertEqual(response.status_code, 400)


class DatasetScenarioTests(APITestCase):
    """Runs every labeled edge case in graph.json's "scenarios" list through the route API."""

    REQUIRED_CASES = {"stairs", "multiple-entrances", "accessible-entrance"}

    @classmethod
    def setUpTestData(cls):
        cls.scenarios = get_graph()["scenarios"]
        cls.locations = {location["id"]: location for location in get_locations()}

    def test_required_cases_are_labeled(self):
        self.assertTrue(self.REQUIRED_CASES <= {scenario["case"] for scenario in self.scenarios})

    def test_every_entrance_has_an_accessibility_flag(self):
        # true = accessible, false = not accessible, null = not yet verified (never assume accessible)
        for location in self.locations.values():
            for entrance in location["entrances"]:
                with self.subTest(entrance=entrance["id"]):
                    self.assertIn("accessible", entrance)
                    self.assertIn(entrance["accessible"], (True, False, None))

    def test_accessible_entrance_scenarios_target_accessible_entrances(self):
        for scenario in self.scenarios:
            if scenario["case"] != "accessible-entrance":
                continue
            with self.subTest(scenario=scenario["id"]):
                entrance_id = scenario["destination_entrance_id"]
                entrance = next(item for item in self.locations[scenario["destination_id"]]["entrances"]
                                if item["id"] == entrance_id)
                self.assertIs(entrance["accessible"], True)

    def test_scenarios_reference_existing_locations_and_entrances(self):
        ids = [scenario["id"] for scenario in self.scenarios]
        self.assertEqual(len(ids), len(set(ids)), "scenario ids must be unique")
        for scenario in self.scenarios:
            with self.subTest(scenario=scenario["id"]):
                self.assertIn(scenario["expect"], {"route", "no_route"})
                for end in ("start", "destination"):
                    location = self.locations.get(scenario[f"{end}_id"])
                    self.assertIsNotNone(location, f"unknown {end}_id")
                    entrance_id = scenario.get(f"{end}_entrance_id")
                    if entrance_id:
                        self.assertIn(entrance_id, [item["id"] for item in location["entrances"]])

    def test_scenarios_route_as_labeled(self):
        for scenario in self.scenarios:
            with self.subTest(scenario=scenario["id"]):
                response = self.client.post(
                    "/api/route/",
                    {
                        field: scenario[field]
                        for field in ("start_id", "destination_id", "start_entrance_id",
                                      "destination_entrance_id", "avoid_stairs")
                        if field in scenario
                    },
                    format="json",
                )
                if scenario["expect"] == "no_route":
                    self.assertEqual(response.status_code, 404)
                    if "detail" in scenario:
                        self.assertEqual(response.data["detail"], scenario["detail"])
                    continue

                self.assertEqual(response.status_code, 200)
                if "used_stairs" in scenario:
                    self.assertEqual(response.data["usedStairs"], scenario["used_stairs"])
                for end, point in (("start", response.data["points"][0]),
                                   ("destination", response.data["points"][-1])):
                    entrance_id = scenario.get(f"{end}_entrance_id")
                    if entrance_id:
                        entrance = next(item for item in self.locations[scenario[f"{end}_id"]]["entrances"]
                                        if item["id"] == entrance_id)
                        self.assertEqual((point["lat"], point["lng"]), (entrance["lat"], entrance["lng"]))
