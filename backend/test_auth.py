import json
import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import patch

from fastapi.testclient import TestClient

import main


class AuthProfiles:
    def __init__(self, profiles):
        self.profiles = profiles

    async def find_one(self, query, projection=None):
        def lookup(document, key):
            if key == "personal_information.email":
                return document.get("personal_information", {}).get("email")
            return document.get(key)

        for profile in self.profiles:
            matched = True
            for key, expected in query.items():
                actual = lookup(profile, key)
                if isinstance(expected, dict) and "$gt" in expected:
                    matched = actual is not None and actual > expected["$gt"]
                else:
                    matched = actual == expected
                if not matched:
                    break
            if matched:
                return dict(profile)
        return None

    async def update_one(self, query, update):
        for profile in self.profiles:
            if profile.get("user_id") != query.get("user_id"):
                continue
            profile.update(update.get("$set", {}))
            for key in update.get("$unset", {}):
                profile.pop(key, None)
            return SimpleNamespace(matched_count=1, modified_count=1)
        return SimpleNamespace(matched_count=0, modified_count=0)


class MemoryCollection:
    def __init__(self, document=None):
        self.document = document

    async def find_one(self, query, projection=None, sort=None):
        if self.document and all(self.document.get(key) == value for key, value in query.items()):
            return dict(self.document)
        return None

    async def update_one(self, query, update, upsert=False):
        if self.document is None and upsert:
            self.document = {}
        if self.document is None:
            return SimpleNamespace(matched_count=0, modified_count=0)
        self.document.update(update.get("$set", {}))
        if "$setOnInsert" in update:
            for key, value in update["$setOnInsert"].items():
                self.document.setdefault(key, value)
        return SimpleNamespace(matched_count=1, modified_count=1)


class MemoryDatabase:
    def __init__(self, **collections):
        self.collections = collections

    def __getitem__(self, name):
        return self.collections.setdefault(name, MemoryCollection())


class MemoryMongo:
    def __init__(self, database):
        self.database = database

    def __getitem__(self, _name):
        return self.database


class AuthenticationTests(unittest.TestCase):
    def setUp(self):
        self.profile = {
            "user_id": "usr_auth_student",
            "personal_information": {"email": "student@example.com", "full_name": "Test Student"},
            "password_hash": main.hash_password("StrongPassword123"),
        }
        self.collection = AuthProfiles([self.profile])
        self.patches = [
            patch.object(main, "mongo_status", "connected"),
            patch.object(main, "profiles_collection", return_value=self.collection),
        ]
        for item in self.patches:
            item.start()
            self.addCleanup(item.stop)
        self.client = TestClient(main.app)

    def test_login_sets_http_only_cookie_and_restores_profile(self):
        response = self.client.post(
            "/api/auth/login",
            json={"email": "student@example.com", "password": "StrongPassword123"},
        )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(response.json()["user_id"], "usr_auth_student")
        self.assertNotIn("session_token", response.json())
        self.assertNotIn("password_hash", response.text)
        self.assertIn("httponly", response.headers["set-cookie"].lower())

        restored = self.client.get("/api/auth/session")
        self.assertEqual(restored.status_code, 200, restored.text)
        self.assertEqual(restored.json()["profile"]["user_id"], "usr_auth_student")
        self.assertNotIn("password_hash", restored.text)

    def test_invalid_password_does_not_authenticate(self):
        response = self.client.post(
            "/api/auth/login",
            json={"email": "student@example.com", "password": "IncorrectPassword"},
        )
        self.assertEqual(response.status_code, 401)
        self.assertEqual(self.client.get("/api/auth/session").status_code, 401)

    def test_logout_revokes_cookie_session(self):
        self.assertEqual(
            self.client.post("/api/auth/login", json={"email": "student@example.com", "password": "StrongPassword123"}).status_code,
            200,
        )
        response = self.client.post("/api/auth/logout")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.client.get("/api/auth/session").status_code, 401)
        self.assertNotIn("auth_token_hash", self.profile)

    def test_password_hash_is_salted_and_verifiable(self):
        first = main.hash_password("StrongPassword123")
        second = main.hash_password("StrongPassword123")
        self.assertNotEqual(first, second)
        self.assertTrue(main.verify_password("StrongPassword123", first))
        self.assertFalse(main.verify_password("wrong", first))
        self.assertFalse(main.verify_password("anything", "invalid"))

    def test_profile_id_does_not_authorize_access_to_another_student(self):
        response = self.client.get("/api/users/usr_other_student")
        self.assertEqual(response.status_code, 401)

    def test_expired_session_is_rejected(self):
        expired_token = "expired-session-token"
        self.profile["auth_token_hash"] = main.hashlib.sha256(expired_token.encode()).hexdigest()
        self.profile["auth_token_expires_at"] = datetime.now(timezone.utc).replace(year=2020)
        self.client.cookies.set("vaishu_session", expired_token)
        self.assertEqual(self.client.get("/api/auth/session").status_code, 401)

    def test_authenticated_student_cannot_read_another_profile(self):
        login = self.client.post("/api/auth/login", json={"email": "student@example.com", "password": "StrongPassword123"})
        self.assertEqual(login.status_code, 200)
        response = self.client.get("/api/users/usr_someone_else")
        self.assertEqual(response.status_code, 403)

    def test_jobs_return_unconfigured_state_without_fabricated_records(self):
        database = MemoryDatabase()
        profile_patch = patch.object(main, "profile_for_request", new=unittest.mock.AsyncMock(return_value={"user_id": "usr_auth_student", "career_goals": {"target_role": "Developer"}}))
        with patch.object(main, "mongo_client", MemoryMongo(database)), patch.object(main, "mongo_status", "connected"), patch.object(main, "ADZUNA_ENABLED", False), patch.object(main, "ADZUNA_APP_ID", ""), patch.object(main, "ADZUNA_APP_KEY", ""), profile_patch:
            response = self.client.get("/api/jobs/recommendations")
        self.assertEqual(response.status_code, 200, response.text)
        self.assertFalse(response.json()["configured"])
        self.assertEqual(response.json()["jobs"], [])
        self.assertIn("not configured", response.json()["message"])

    def test_learning_calendar_persists_and_reschedules_student_tasks(self):
        profile = {"user_id": "usr_auth_student"}
        task_path = {
            "skills": [{
                "skill": "Python",
                "status": "needs_improvement",
                "topics": [{
                    "topic": "Variables and data types",
                    "status": "in_progress",
                    "assessment_status": "needs_improvement",
                    "assessment_score": 40,
                    "tasks": [
                        {"task_id": "task-1", "description": "Review variables", "completed": False},
                        {"task_id": "task-2", "description": "Practice data types", "completed": False},
                    ],
                }],
            }],
        }
        calendar_collection = MemoryCollection()
        database = MemoryDatabase(
            learning_calendars=calendar_collection,
            learning_plans=MemoryCollection(),
        )
        profile_patch = patch.object(main, "profile_for_request", new=unittest.mock.AsyncMock(return_value=profile))
        with patch.object(main, "mongo_client", MemoryMongo(database)), patch.object(main, "mongo_status", "connected"), patch.object(main, "skill_path_data", new=unittest.mock.AsyncMock(return_value=task_path)), profile_patch:
            today = datetime.now(timezone.utc).date().isoformat()
            created = self.client.put("/api/learning/calendar", json={"weekly_minutes": 60, "start_date": today})
            self.assertEqual(created.status_code, 200, created.text)
            tasks = created.json()["tasks"]
            self.assertEqual(len(tasks), 2)
            self.assertEqual(tasks[0]["status"], "pending")
            tomorrow = (datetime.now(timezone.utc).date() + main.timedelta(days=1)).isoformat()
            moved = self.client.put("/api/learning/calendar/task", json={"task_id": tasks[0]["task_id"], "scheduled_date": tomorrow})
        self.assertEqual(moved.status_code, 200, moved.text)
        self.assertEqual(next(item for item in moved.json()["tasks"] if item["task_id"] == tasks[0]["task_id"])["scheduled_date"], tomorrow)

        other_profile = patch.object(main, "profile_for_request", new=unittest.mock.AsyncMock(return_value={"user_id": "usr_other"}))
        with patch.object(main, "mongo_client", MemoryMongo(database)), patch.object(main, "mongo_status", "connected"), patch.object(main, "skill_path_data", new=unittest.mock.AsyncMock(return_value=task_path)), other_profile:
            forbidden = self.client.put("/api/learning/calendar/task", json={"task_id": tasks[0]["task_id"], "scheduled_date": tomorrow})
        self.assertEqual(forbidden.status_code, 404)

    def test_adzuna_application_urls_are_https_and_provider_scoped(self):
        self.assertTrue(main.valid_adzuna_url("https://www.adzuna.com/jobs/example"))
        self.assertTrue(main.valid_adzuna_url("http://adzuna.co.uk/jobs/example"))
        self.assertEqual(main.secure_adzuna_url("http://adzuna.co.uk/jobs/example"), "https://adzuna.co.uk/jobs/example")
        self.assertFalse(main.valid_adzuna_url("https://adzuna.com.attacker.invalid/jobs/example"))
        self.assertFalse(main.valid_adzuna_url("javascript:alert(1)"))

    def test_adzuna_results_are_deduplicated_validated_and_limited(self):
        jobs = [{
            "id": str(index),
            "title": f"Developer {index}",
            "company": {"display_name": "Example Co"},
            "location": {"display_name": "Remote"},
            "created": "2026-10-21T00:00:00Z",
            "redirect_url": f"http://adzuna.co.uk/jobs/{index}",
        } for index in range(12)]
        jobs.append(dict(jobs[0]))
        jobs.append({"id": "bad", "redirect_url": "https://not-adzuna.invalid/job"})

        class Response:
            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return None

            def read(self):
                return json.dumps({"results": jobs}).encode()

        with patch.object(main, "urlopen", return_value=Response()):
            results = main.fetch_adzuna_jobs("Developer", "Remote", "in")
        self.assertEqual(len(results), 10)
        self.assertEqual(len({item["source_id"] for item in results}), 10)
        self.assertTrue(all(item["application_url"].startswith("https://adzuna.co.uk/") for item in results))
        self.assertTrue(all(item["required_skills"] is None for item in results))


if __name__ == "__main__":
    unittest.main()
