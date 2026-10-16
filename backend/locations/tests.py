import copy
from unittest import TestCase

from rest_framework.test import APITestCase

from .graph import get_graph, get_locations
from .validate_graph import components, validate


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

    REQUIRED_CASES = {"stairs", "multiple-entrances", "accessible-entrance", "disconnected",
                      "no-accessible-route"}

    @classmethod
    def setUpTestData(cls):
        cls.scenarios = get_graph()["scenarios"]
        cls.locations = {location["id"]: location for location in get_locations()}

    def test_required_cases_are_labeled(self):
        self.assertTrue(self.REQUIRED_CASES <= {scenario["case"] for scenario in self.scenarios})

    def test_only_mock_nodes_are_disconnected_from_campus(self):
        graph = get_graph()
        campus, *islands = components(graph)
        mock_ids = {node["id"] for node in graph["nodes"] if node.get("mock")}
        self.assertTrue(islands, "the dataset should contain an intentional disconnected area")
        for island in islands:
            with self.subTest(island=sorted(island)):
                self.assertLessEqual(island, mock_ids, "real nodes are unreachable from campus")

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


class ValidateGraphTests(TestCase):
    """validate_graph.py should pass the real dataset and catch each kind of data mistake."""

    BASE = {
        "nodes": [
            {"id": "hall", "name": "Hall", "lat": 0, "lng": 0, "type": "location",
             "entrances": [{"id": "hall-e1", "lat": 0, "lng": 0, "label": "Main", "accessible": True}]},
            {"id": "lab", "name": "Lab", "lat": 0, "lng": 1, "type": "location",
             "entrances": [{"id": "lab-e1", "lat": 0, "lng": 1, "label": "Main", "accessible": None}]},
            {"id": "j1", "lat": 0, "lng": 0.5, "type": "path"},
        ],
        "edges": [
            {"a": "hall", "b": "j1", "type": "path"},
            {"a": "j1", "b": "lab", "type": "path"},
        ],
        "scenarios": [
            {"id": "hall-to-lab", "case": "stairs", "start_id": "hall", "destination_id": "lab", "expect": "route"},
        ],
    }

    def graph(self):
        return copy.deepcopy(self.BASE)

    def assert_error(self, graph, fragment):
        errors, _ = validate(graph)
        self.assertTrue(any(fragment in error for error in errors), f"{fragment!r} not in {errors}")

    def test_real_dataset_has_no_errors(self):
        self.assertEqual(validate(get_graph())[0], [])

    def test_valid_example_has_no_errors(self):
        self.assertEqual(validate(self.graph())[0], [])

    def test_catches_dangling_edge(self):
        graph = self.graph()
        graph["edges"].append({"a": "lab", "b": "gym", "type": "path"})
        self.assert_error(graph, "points at missing node 'gym'")

    def test_catches_duplicate_ids(self):
        graph = self.graph()
        graph["nodes"].append(copy.deepcopy(graph["nodes"][2]))
        graph["nodes"][1]["entrances"][0]["id"] = "hall-e1"
        self.assert_error(graph, "duplicate node id: j1")
        self.assert_error(graph, "duplicate entrance id: hall-e1")

    def test_catches_building_without_entrances(self):
        graph = self.graph()
        graph["nodes"][1]["entrances"] = []
        self.assert_error(graph, "building lab: has no entrances")

    def test_catches_entrance_without_accessibility_flag(self):
        graph = self.graph()
        del graph["nodes"][0]["entrances"][0]["accessible"]
        self.assert_error(graph, "entrance hall-e1: missing 'accessible'")

    def test_catches_scenario_with_unknown_location(self):
        graph = self.graph()
        graph["scenarios"][0]["destination_id"] = "gym"
        self.assert_error(graph, "unknown destination_id 'gym'")

    def test_real_disconnected_node_is_an_error_but_mock_one_is_reported(self):
        graph = self.graph()
        graph["edges"] = graph["edges"][:1]  # cuts lab off from campus
        self.assert_error(graph, "unreachable from campus (not marked mock): lab")

        graph["nodes"][1]["mock"] = True
        errors, notes = validate(graph)
        self.assertEqual(errors, [])
        self.assertIn("intentional disconnected area (mock): lab", notes)

    def test_stairs_only_location_is_reported_not_an_error(self):
        graph = self.graph()
        graph["edges"][1]["type"] = "stairs"
        errors, notes = validate(graph)
        self.assertEqual(errors, [])
        self.assertIn("no stairs-free route from campus (real): lab", notes)
