import json
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

import main


class FakeModels:
    def __init__(self, answer="A useful answer.", error=None, usage=True):
        self.answer = answer
        self.error = error
        self.usage = usage
        self.count_calls = 0
        self.generate_calls = 0

    def count_tokens(self, *, model, contents):
        self.count_calls += 1
        text = " ".join(part.text or "" for item in contents for part in (item.parts or []))
        return SimpleNamespace(total_tokens=max(1, len(text) // 4))

    def generate_content(self, *, model, contents, config):
        self.generate_calls += 1
        if self.error:
            raise self.error
        metadata = SimpleNamespace(prompt_token_count=12, candidates_token_count=7, total_token_count=19) if self.usage else None
        return SimpleNamespace(text=self.answer, usage_metadata=metadata)


class FakeClient:
    def __init__(self, models):
        self.models = models


class RecordingModels(FakeModels):
    def __init__(self):
        super().__init__()
        self.last_config = None

    def generate_content(self, *, model, contents, config):
        self.last_config = config
        return super().generate_content(model=model, contents=contents, config=config)


class ProfileCollection:
    async def find_one(self, query, projection=None):
        return {
            "user_id": query["user_id"],
            "personal_information": {"preferred_name": "Sam", "full_name": "Sam Student"},
            "education": {"highest_education_level": "Undergraduate", "degree_course": "B.Tech", "subjects": ["Python"]},
            "skills": {"programming_languages": ["Python"]},
            "career_goals": {"short_term_career_goal": "Build backend skills", "preferred_difficulty": "Easy"},
        }


class ChatApiTests(unittest.TestCase):
    def setUp(self):
        main.fallback_rate_limit.clear()
        self.client = TestClient(main.app)
        self.profile_patch = patch.object(main, "profile_for_request", new=AsyncMock(return_value={"user_id": "usr_abcdef123456"}))
        self.profile_patch.start()
        self.addCleanup(self.profile_patch.stop)

    def test_usage_and_secret_safety(self):
        fake = FakeModels()
        with patch.object(main, "gemini_client", FakeClient(fake)):
            response = self.client.post("/api/chat", headers={"X-Chat-Session": "usage-test"}, json={"message": "Help me plan my next career step.", "history": []})
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["usage"], {"input_tokens": 12, "output_tokens": 7, "total_tokens": 19})
        self.assertFalse(payload["preflight_input_tokens_estimated"])
        self.assertNotIn("GEMINI_API_KEY", json.dumps(payload))
        self.assertEqual(fake.count_calls, 1)
        self.assertEqual(fake.generate_calls, 1)

    def test_rejects_blank_oversized_and_long_history(self):
        self.assertEqual(self.client.post("/api/chat", json={"message": "   "}).status_code, 422)
        self.assertEqual(self.client.post("/api/chat", json={"message": "x" * (main.CHAT_MAX_MESSAGE_CHARS + 1)}).status_code, 422)
        history = [{"role": "user", "content": "ok"}] * (main.CHAT_MAX_HISTORY_MESSAGES + 1)
        self.assertEqual(self.client.post("/api/chat", json={"message": "hello", "history": history}).status_code, 422)

    def test_quota_error_is_safe(self):
        fake = FakeModels(error=RuntimeError("429 RESOURCE_EXHAUSTED secret-details"))
        with patch.object(main, "gemini_client", FakeClient(fake)):
            response = self.client.post("/api/chat", headers={"X-Chat-Session": "quota-test"}, json={"message": "hello"})
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.json()["detail"], "Gemini is temporarily rate-limited. Please try again later.")
        self.assertNotIn("secret-details", response.text)

    def test_rate_limits_session(self):
        fake = FakeModels()
        with patch.object(main, "gemini_client", FakeClient(fake)), patch.object(main, "CHAT_MAX_REQUESTS", 1):
            headers = {"X-Chat-Session": "rate-test"}
            self.assertEqual(self.client.post("/api/chat", headers=headers, json={"message": "first"}).status_code, 200)
            response = self.client.post("/api/chat", headers=headers, json={"message": "second"})
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.headers["retry-after"], str(main.CHAT_RATE_LIMIT_WINDOW))

    def test_missing_key_error(self):
        with patch.object(main, "gemini_client", None):
            response = self.client.post("/api/chat", json={"message": "hello"})
        self.assertEqual(response.status_code, 503)
        self.assertIn("GEMINI_API_KEY", response.json()["detail"])

    def test_profile_access_requires_session(self):
        with patch.object(main, "profile_for_request", new=AsyncMock(return_value=None)):
            response = self.client.get("/api/users")
        self.assertEqual(response.status_code, 401)

    def test_chat_uses_saved_profile_context(self):
        fake_models = RecordingModels()
        profile = {
            "user_id": "usr_abcdef123456",
            "personal_information": {"preferred_name": "Sam", "full_name": "Sam Student"},
            "education": {"highest_education_level": "Undergraduate", "degree_course": "B.Tech", "subjects": ["Python"]},
            "skills": {"programming_languages": ["Python"]},
            "career_goals": {"short_term_career_goal": "Build backend skills", "preferred_difficulty": "Easy"},
        }
        with patch.object(main, "gemini_client", FakeClient(fake_models)), \
             patch.object(main, "profile_for_request", new=AsyncMock(return_value=profile)):
            response = self.client.post("/api/chat", headers={"X-Chat-Session": "profile-chat", "X-User-ID": "usr_abcdef123456"}, json={"message": "Help me plan Python practice."})
        self.assertEqual(response.status_code, 200)
        self.assertIn("Sam", fake_models.last_config.system_instruction)
        self.assertIn("Python", fake_models.last_config.system_instruction)


if __name__ == "__main__":
    unittest.main()
