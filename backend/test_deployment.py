import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

import main


class DeploymentTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(main.app)

    def test_root_serves_existing_onboarding_page(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("Vaishu", response.text)
        self.assertIn("onboarding", response.text.lower())

    def test_static_frontend_asset_is_served(self):
        response = self.client.get("/app.js")
        self.assertEqual(response.status_code, 200)
        self.assertIn("const API_BASE_URL = ''", response.text)

    def test_health_endpoint_reports_database_readiness_without_details(self):
        with patch.object(main, "mongo_client", None), patch.object(main, "mongo_status", "not_initialized"):
            response = self.client.get("/health")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json(), {"status": "unavailable", "database": "unavailable"})
        self.assertNotIn("database_error", response.json())


if __name__ == "__main__":
    unittest.main()
