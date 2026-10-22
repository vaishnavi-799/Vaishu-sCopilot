import asyncio
import json
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

import main


def generated_questions(count=5):
    return {"questions": [{
        "question_id": f"q{index}",
        "prompt": f"Which idea best applies to lesson concept {index}?",
        "option_a": "The first approach",
        "option_b": "The second approach",
        "option_c": "The third approach",
        "option_d": "The fourth approach",
        "correct_answer": "A",
        "explanation": "The first approach applies the lesson correctly.",
        "topic": "Core concept",
    } for index in range(1, count + 1)]}


class FakeTestModels:
    def generate_content(self, *, model, contents, config):
        return SimpleNamespace(text=json.dumps(generated_questions()), parsed=None)


class FakeClient:
    def __init__(self):
        self.models = FakeTestModels()


class FakeProviderError(Exception):
    def __init__(self, code, status, message):
        super().__init__(message)
        self.code = code
        self.status = status
        self.message = message
        self.details = message
        self.response = SimpleNamespace(headers={})


class RetryingTestModels:
    def __init__(self, errors):
        self.errors = list(errors)
        self.calls = 0

    def generate_content(self, *, model, contents, config):
        self.calls += 1
        if self.errors:
            error = self.errors.pop(0)
            if error:
                raise error
        return SimpleNamespace(text=json.dumps(generated_questions()), parsed=None)


class RetryingTestClient:
    def __init__(self, models):
        self.models = models


class FakeLearningPlanCollection:
    def __init__(self, user_id):
        self.document = {
            "_id": "plan-id",
            "user_id": user_id,
            "created_at": main.datetime(2025, 1, 1, tzinfo=main.timezone.utc),
            "tasks": [{"topic": "Python", "task": "Review functions", "estimated_minutes": 30, "completed": False}],
            "recommended_next_assessment": {"action": "Retake", "topic": "Python", "difficulty": "Easy"},
        }

    async def find_one(self, query, projection=None, sort=None):
        if all(self.document.get(key) == value for key, value in query.items()):
            return dict(self.document)
        return None

    async def update_one(self, query, update):
        if not all(self.document.get(key) == value for key, value in query.items()):
            return SimpleNamespace(modified_count=0)
        for path, value in update["$set"].items():
            if path.startswith("tasks."):
                _, index, field = path.split(".")
                self.document["tasks"][int(index)][field] = value
            else:
                self.document[path] = value
        return SimpleNamespace(modified_count=1)


class FakeLearningPlanMongo:
    def __init__(self, collection):
        self.collections = {
            "learning_tests": object(),
            "learning_plans": collection,
            "topic_learning_progress": FakeTopicProgressCollection(),
        }

    def __getitem__(self, _database):
        return self.collections


class FakeAsyncCursor:
    def __init__(self, items):
        self.items = items

    def __aiter__(self):
        async def generate():
            for item in self.items:
                yield dict(item)
        return generate()


class FakeTopicProgressCollection:
    def __init__(self):
        self.documents = []

    def find(self, query, projection=None):
        return FakeAsyncCursor([
            item for item in self.documents
            if all(item.get(key) == value for key, value in query.items())
        ])

    async def update_one(self, query, update, upsert=False):
        item = next(
            (record for record in self.documents if all(record.get(key) == value for key, value in query.items())),
            None,
        )
        if item is None:
            if not upsert:
                return SimpleNamespace(matched_count=0, modified_count=0)
            item = dict(query)
            self.documents.append(item)
        item.update(update.get("$set", {}))
        return SimpleNamespace(matched_count=1, modified_count=1)


class TestFlowTests(unittest.TestCase):
    def setUp(self):
        main.fallback_active_tests.clear()
        main.fallback_rate_limit.clear()
        main.fallback_skill_verifications.clear()
        main.fallback_learning_plans.clear()
        main.fallback_topic_learning_progress.clear()
        self.client = TestClient(main.app)
        self.client_headers = {"X-Chat-Session": "test-flow-session"}
        self.profile_patch = patch.object(main, "profile_for_request", new=AsyncMock(return_value={"user_id": "usr_abcdef123456"}))
        self.profile_patch.start()
        self.addCleanup(self.profile_patch.stop)

    def test_generate_submit_and_history(self):
        with patch.object(main, "gemini_client", FakeClient()):
            generated = self.client.post("/api/tests/generate", headers=self.client_headers, json={"topic": "Python functions", "difficulty": "Medium", "question_count": 5, "history": []})
            self.assertEqual(generated.status_code, 200)
            public_payload = generated.json()
            self.assertEqual(len(public_payload["questions"]), 5)
            self.assertNotIn("correct_answer", generated.text)
            self.assertNotIn("explanation", generated.text)

            test_id = public_payload["test_id"]
            submitted = self.client.post("/api/tests/submit", headers=self.client_headers, json={"test_id": test_id, "answers": {"q1": "A", "q2": "A", "q3": "A", "q4": "B", "q5": "A"}})
            self.assertEqual(submitted.status_code, 200)
            result = submitted.json()
            self.assertEqual(result["correct_count"], 4)
            self.assertEqual(result["incorrect_count"], 1)
            self.assertEqual(result["percentage"], 80.0)
            self.assertTrue(result["passed"])
            self.assertEqual(result["passing_percentage"], 70)
            self.assertIsNotNone(result["verified_skill"])
            self.assertEqual(result["learning_plan"]["recommended_next_assessment"]["action"], "Take a new assessment")
            verified = self.client.get("/api/tests/skills", headers=self.client_headers)
            self.assertEqual(verified.status_code, 200)
            self.assertEqual(verified.json()["skills"][0]["skill"], "Python functions")
            self.assertEqual(len(result["review"]), 5)
            self.assertTrue(all("correct_answer" in item for item in result["review"]))
            self.assertEqual(result["concepts_to_review"], ["Core concept"])

            history = self.client.get("/api/tests/history", headers=self.client_headers)
            self.assertEqual(history.status_code, 200)
            self.assertEqual(history.json()["tests"][0]["test_id"], test_id)

            duplicate = self.client.post("/api/tests/submit", headers=self.client_headers, json={"test_id": test_id, "answers": {}})
            self.assertEqual(duplicate.status_code, 409)

    def test_topic_required_without_enough_lesson_context(self):
        with patch.object(main, "gemini_client", FakeClient()):
            response = self.client.post("/api/tests/generate", headers=self.client_headers, json={"difficulty": "Easy", "question_count": 5, "history": []})
        self.assertEqual(response.status_code, 422)

    def test_test_is_private_to_session(self):
        with patch.object(main, "gemini_client", FakeClient()):
            generated = self.client.post("/api/tests/generate", headers=self.client_headers, json={"topic": "Python", "difficulty": "Easy", "question_count": 5})
        test_id = generated.json()["test_id"]
        other = self.client.post("/api/tests/submit", headers={"X-Chat-Session": "other-session"}, json={"test_id": test_id, "answers": {}})
        self.assertEqual(other.status_code, 404)

    def test_transient_rate_limit_retries_once(self):
        fake_models = RetryingTestModels([
            FakeProviderError(429, "RESOURCE_EXHAUSTED", "Try again soon"),
            None,
        ])
        with patch.object(main, "gemini_client", RetryingTestClient(fake_models)), \
             patch.object(main, "ENABLE_MOCK_QUIZ", False), \
             patch.object(main, "GEMINI_MAX_RETRIES", 2), \
             patch.object(main.asyncio, "sleep", new=AsyncMock()):
            response = self.client.post("/api/tests/generate", headers=self.client_headers, json={"topic": "Python strings", "difficulty": "Easy", "question_count": 5})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(fake_models.calls, 2)

    def test_quota_error_is_not_retried(self):
        fake_models = RetryingTestModels([
            FakeProviderError(429, "RESOURCE_EXHAUSTED", "Quota exceeded for today"),
        ])
        with patch.object(main, "gemini_client", RetryingTestClient(fake_models)), \
             patch.object(main, "ENABLE_MOCK_QUIZ", False), \
             patch.object(main, "GEMINI_MAX_RETRIES", 2), \
             patch.object(main.asyncio, "sleep", new=AsyncMock()):
            response = self.client.post("/api/tests/generate", headers=self.client_headers, json={"topic": "Python strings", "difficulty": "Easy", "question_count": 5})
        self.assertEqual(response.status_code, 429)
        self.assertIn("quota is exhausted", response.json()["detail"])
        self.assertEqual(fake_models.calls, 1)

    def test_provider_failure_uses_development_fallback(self):
        fake_models = RetryingTestModels([FakeProviderError(503, "UNAVAILABLE", "provider unavailable")])
        with patch.object(main, "gemini_client", RetryingTestClient(fake_models)), \
             patch.object(main, "ENABLE_MOCK_QUIZ", True):
            response = self.client.post("/api/tests/generate", headers=self.client_headers, json={"topic": "Python", "difficulty": "Easy", "question_count": 5})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["source"], "mock_fallback")
        self.assertEqual(fake_models.calls, 1)

    def test_development_mock_quiz_is_gated_and_labeled(self):
        with patch.object(main, "gemini_client", None), patch.object(main, "ENABLE_MOCK_QUIZ", True):
            response = self.client.post("/api/tests/generate", headers=self.client_headers, json={"topic": "Python strings", "difficulty": "Easy", "question_count": 5, "use_mock": True})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["source"], "mock_sample")
        self.assertEqual(response.json()["questions"][0]["topic"], "Python strings")
        self.assertNotIn("correct_answer", response.text)

    def test_failed_test_uses_seventy_percent_threshold_and_learning_plan(self):
        with patch.object(main, "gemini_client", FakeClient()):
            generated = self.client.post("/api/tests/generate", headers=self.client_headers, json={"subject": "Python", "topic": "Python strings", "difficulty": "Easy", "question_count": 5})
        result = self.client.post("/api/tests/submit", headers=self.client_headers, json={"test_id": generated.json()["test_id"], "answers": {"q1": "A", "q2": "B", "q3": "B", "q4": "B", "q5": "A"}})
        self.assertEqual(result.status_code, 200)
        body = result.json()
        self.assertEqual(body["percentage"], 40.0)
        self.assertFalse(body["passed"])
        self.assertIsNone(body["verified_skill"])
        self.assertTrue(body["learning_plan"]["tasks"])
        progress = self.client.put("/api/tests/learning-plan", headers=self.client_headers, json={"task_index": 0, "completed": True})
        self.assertEqual(progress.status_code, 200)
        self.assertTrue(progress.json()["learning_plan"]["tasks"][0]["completed"])
        refreshed_plan = self.client.get("/api/tests/learning-plan", headers=self.client_headers)
        self.assertEqual(refreshed_plan.status_code, 200)
        self.assertTrue(refreshed_plan.json()["learning_plan"]["tasks"][0]["completed"])

        dashboard = self.client.get("/api/tests/dashboard", headers=self.client_headers)
        self.assertEqual(dashboard.status_code, 200)
        dashboard_body = dashboard.json()
        self.assertEqual(dashboard_body["overview"]["completed_count"], 1)
        self.assertEqual(dashboard_body["overview"]["failed_count"], 1)
        self.assertEqual(dashboard_body["topic_summary"][0]["level"], "Beginner")
        self.assertEqual(dashboard_body["learning_plan"]["tasks"][0]["completed"], True)

    def test_unanswered_questions_are_separate_and_topic_estimate_is_transparent(self):
        with patch.object(main, "gemini_client", FakeClient()):
            generated = self.client.post("/api/tests/generate", headers=self.client_headers, json={"topic": "Python", "question_count": 5})
        response = self.client.post("/api/tests/submit", headers=self.client_headers, json={"test_id": generated.json()["test_id"], "answers": {"q1": "A"}})
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["correct_count"], 1)
        self.assertEqual(body["incorrect_count"], 0)
        self.assertEqual(body["unanswered_count"], 4)
        self.assertEqual(body["topic_analysis"][0]["level"], "Beginner")

    def test_skill_level_boundaries_and_insufficient_data(self):
        self.assertEqual(main.skill_level_for_percentage(49.9, 2), "Beginner")
        self.assertEqual(main.skill_level_for_percentage(50, 2), "Developing")
        self.assertEqual(main.skill_level_for_percentage(69.9, 2), "Developing")
        self.assertEqual(main.skill_level_for_percentage(70, 2), "Proficient")
        self.assertEqual(main.skill_level_for_percentage(84.9, 2), "Proficient")
        self.assertEqual(main.skill_level_for_percentage(85, 2), "Strong")
        self.assertIsNone(main.skill_level_for_percentage(100, 1))

    def test_topic_analysis_marks_single_question_as_insufficient_data(self):
        analysis = main.topic_analysis_from_review([
            {"topic": "Python", "is_correct": True, "selected_answer": "A"},
        ])
        self.assertEqual(analysis[0]["percentage"], 100.0)
        self.assertIsNone(analysis[0]["level"])
        self.assertEqual(analysis[0]["status"], "not_enough_data")

    def test_dashboard_uses_actual_history_and_keeps_skill_sources_separate(self):
        first = main.datetime(2025, 1, 1, tzinfo=main.timezone.utc)
        second = main.datetime(2025, 1, 2, tzinfo=main.timezone.utc)
        profile = {
            "user_id": "usr_dashboard",
            "career_information": {"target_job_role": "Python Developer"},
            "career_goals": {},
            "skills": {"programming_languages": ["Python"], "technical_skills": ["FastAPI"]},
            "resume_information": {"extracted_information": {"skills": ["Docker"]}},
        }
        attempts = [
            {
                "topic": "Python",
                "submitted_at": first,
                "percentage": 50,
                "passed": False,
                "topic_analysis": [{"topic": "Python", "total_questions": 2, "correct_count": 1, "incorrect_count": 1, "unanswered_count": 0}],
            },
            {
                "topic": "SQL",
                "submitted_at": second,
                "percentage": 100,
                "passed": True,
                "topic_analysis": [{"topic": "SQL", "total_questions": 2, "correct_count": 2, "incorrect_count": 0, "unanswered_count": 0}],
            },
        ]
        verified = [{"skill": "SQL", "score": 100, "level": "Easy", "verified_at": second, "assessment_id": "test_sql"}]
        plan = {"tasks": [{"completed": True}, {"completed": False}]}

        dashboard = main.build_dashboard(profile, attempts, verified, plan)

        self.assertEqual(dashboard["overview"]["completed_count"], 2)
        self.assertEqual(dashboard["overview"]["latest_percentage"], 100)
        self.assertEqual(dashboard["strongest_topic"]["topic"], "SQL")
        self.assertEqual(dashboard["weakest_topic"]["topic"], "Python")
        self.assertEqual(dashboard["topic_summary"][0]["level"], "Developing")
        self.assertEqual([item["percentage"] for item in dashboard["score_trend"]], [50, 100])
        self.assertEqual(dashboard["skill_gap"]["not_assessed"], ["Git", "APIs"])
        self.assertEqual(dashboard["skill_gap"]["assessed_needing_improvement"], ["Python"])
        self.assertEqual(dashboard["verified_skills"][0]["skill"], "SQL")
        self.assertEqual(dashboard["profile_skills"], ["Python", "FastAPI"])
        self.assertEqual(dashboard["resume_skills"], ["Docker"])
        self.assertEqual(dashboard["learning_plan_progress"], {"completed_tasks": 1, "total_tasks": 2, "percentage": 50})

    def test_empty_dashboard_does_not_invent_skill_or_progress_data(self):
        dashboard = main.build_dashboard(
            {"user_id": "usr_first_time", "career_information": {}, "career_goals": {}, "skills": {}},
            [],
            [],
            None,
        )
        self.assertIsNone(dashboard["overview"]["latest_percentage"])
        self.assertEqual(dashboard["overview"]["completed_count"], 0)
        self.assertEqual(dashboard["topic_summary"], [])
        self.assertEqual(dashboard["score_trend"], [])
        self.assertIsNone(dashboard["learning_plan_progress"])
        self.assertEqual(dashboard["next_action"], "Take your first assessment to establish a baseline.")

    def test_dashboard_counts_full_history_and_limits_only_the_visible_trend(self):
        start = main.datetime(2025, 1, 1, tzinfo=main.timezone.utc)
        attempts = [
            {
                "topic": f"Topic {index}",
                "submitted_at": start + main.timedelta(days=index),
                "percentage": index,
                "passed": index >= main.PASSING_SCORE_PERCENTAGE,
                "topic_analysis": [],
            }
            for index in range(55)
        ]

        dashboard = main.build_dashboard(
            {"user_id": "usr_long_history", "career_information": {}, "career_goals": {}, "skills": {}},
            attempts,
            [],
            None,
        )

        self.assertEqual(dashboard["overview"]["completed_count"], 55)
        self.assertEqual(len(dashboard["score_trend"]), 20)
        self.assertEqual(dashboard["score_trend"][0]["percentage"], 35)
        self.assertEqual(dashboard["score_trend"][-1]["percentage"], 54)

    def test_dashboard_aggregates_topic_question_counts_and_separates_latest_average(self):
        attempts = [
            {
                "topic": "Python",
                "subject": "Python",
                "submitted_at": main.datetime(2025, 1, 1, tzinfo=main.timezone.utc),
                "score": "0/5",
                "percentage": 0,
                "passed": False,
                "topic_analysis": [{"topic": "Python", "total_questions": 5, "correct_count": 0, "incorrect_count": 5, "unanswered_count": 0}],
            },
            {
                "topic": "Python",
                "subject": "Python",
                "submitted_at": main.datetime(2025, 1, 2, tzinfo=main.timezone.utc),
                "score": "0/5",
                "percentage": 0,
                "passed": False,
                "topic_analysis": [{"topic": "Python", "total_questions": 5, "correct_count": 0, "incorrect_count": 5, "unanswered_count": 0}],
            },
        ]
        dashboard = main.build_dashboard(
            {"user_id": "usr_scores", "career_information": {}, "career_goals": {}, "skills": {}},
            attempts,
            [],
            None,
        )

        self.assertEqual(dashboard["overview"]["latest_score"], "0/5")
        self.assertEqual(dashboard["overview"]["latest_percentage"], 0)
        self.assertEqual(dashboard["overview"]["average_percentage"], 0)
        python_topic = next(item for item in dashboard["topic_summary"] if item["topic"] == "Python")
        self.assertEqual((python_topic["correct_count"], python_topic["total_questions"]), (0, 10))
        self.assertEqual([item["percentage"] for item in dashboard["score_trend"]], [0, 0])

    def test_topic_task_progress_requires_topic_assessment_to_complete(self):
        profile = {"user_id": "usr_abcdef123456", "career_information": {}, "career_goals": {}, "skills": {}}
        response = self.client.put(
            "/api/tests/topic-progress",
            headers=self.client_headers,
            json={"skill": "Python", "topic": "Variables and data types", "task_id": "task-1", "completed": True},
        )
        self.assertEqual(response.status_code, 200)
        skill = next(item for item in response.json()["skills"] if item["skill"] == "Python")
        variables = skill["topics"][0]
        self.assertEqual(variables["status"], "in_progress")
        self.assertEqual(variables["assessment_status"], "not_assessed")
        self.assertIsNone(variables["assessment_score"])
        self.assertFalse(skill["eligible_for_resume"])
        self.assertIn(("python", "variables-and-data-types"), main.fallback_topic_learning_progress[profile["user_id"]])

    def test_topic_task_progress_is_persisted_in_student_scoped_mongodb_records(self):
        mongo = FakeLearningPlanMongo(object())
        with patch.object(main, "mongo_client", mongo), \
             patch.object(main, "mongo_status", "connected"), \
             patch.object(main, "profile_for_request", new=AsyncMock(return_value={"user_id": "usr_abcdef123456"})), \
             patch.object(main, "dashboard_data", new=AsyncMock(return_value=([], [], None))):
            response = self.client.put(
                "/api/tests/topic-progress",
                headers=self.client_headers,
                json={"skill": "Python", "topic": "Functions", "task_id": "task-1", "completed": True},
            )

        self.assertEqual(response.status_code, 200, response.text)
        records = mongo.collections["topic_learning_progress"].documents
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]["user_id"], "usr_abcdef123456")
        self.assertEqual(records[0]["skill"], "Python")
        self.assertEqual(records[0]["topic"], "Functions")
        self.assertEqual(records[0]["tasks"][0]["completed"], True)
        self.assertEqual(records[0]["status"], "in_progress")
        self.assertEqual(records[0]["assessment_status"], "not_assessed")

    def test_resume_qualification_requires_every_topic_and_a_passed_skill_assessment(self):
        profile = {
            "user_id": "usr_qualification",
            "career_information": {"target_job_role": "Python Developer"},
            "career_goals": {},
            "skills": {},
            "resume_information": {"extracted_information": {"skills": []}},
        }
        topics = main.SKILL_PATHS["python"]
        progress = []
        attempts = []
        for topic_name, task_names in topics:
            progress.append({
                "user_id": profile["user_id"],
                "skill": "Python",
                "skill_key": "python",
                "topic": topic_name,
                "topic_key": main.skill_topic_key(topic_name),
                "tasks": [{"task_id": f"task-{index + 1}", "completed": True} for index in range(len(task_names))],
            })
            attempts.append({
                "test_id": f"test-{main.skill_topic_key(topic_name)}",
                "topic": topic_name,
                "subject": topic_name,
                "percentage": 100,
                "passed": True,
                "submitted_at": main.datetime(2025, 1, 1, tzinfo=main.timezone.utc),
                "topic_analysis": [{"topic": topic_name, "total_questions": 2, "correct_count": 2, "percentage": 100}],
            })

        async def get_path(attempt_records, progress_records):
            with patch.object(main, "dashboard_data", new=AsyncMock(return_value=(attempt_records, [], None))), \
                 patch.object(main, "load_topic_progress", new=AsyncMock(return_value=progress_records)):
                return await main.skill_path_data(profile, "Python Developer")

        without_skill_assessment = asyncio.run(get_path(attempts, progress))
        python = next(item for item in without_skill_assessment["skills"] if item["skill"] == "Python")
        self.assertTrue(python["required_topics_complete"])
        self.assertFalse(python["eligible_for_resume"])

        skill_assessment = {
            "test_id": "python-skill-assessment",
            "topic": "Python",
            "subject": "Python",
            "percentage": 80,
            "passed": True,
            "submitted_at": main.datetime(2025, 1, 2, tzinfo=main.timezone.utc),
            "topic_analysis": [{"topic": "Python", "total_questions": 5, "correct_count": 4, "percentage": 80}],
        }
        complete = asyncio.run(get_path([*attempts, skill_assessment], progress))
        eligible_python = next(item for item in complete["qualified_skills"] if item["skill"] == "Python")
        self.assertEqual(eligible_python["assessment_id"], "python-skill-assessment")
        self.assertEqual(eligible_python["score"], 80)

        incomplete = [*progress]
        incomplete[-1] = {**incomplete[-1], "tasks": [{**task, "completed": False} for task in incomplete[-1]["tasks"]]}
        not_eligible = asyncio.run(get_path([*attempts, skill_assessment], incomplete))
        self.assertNotIn("Python", [item["skill"] for item in not_eligible["qualified_skills"]])

    def test_dashboard_history_is_scoped_to_authenticated_student(self):
        own_attempt = {
            "user_id": "usr_abcdef123456",
            "status": "submitted",
            "topic": "Python",
            "submitted_at": main.datetime(2025, 1, 1, tzinfo=main.timezone.utc),
            "percentage": 80,
            "passed": True,
            "topic_analysis": [{"topic": "Python", "total_questions": 2, "correct_count": 2, "incorrect_count": 0, "unanswered_count": 0}],
        }
        other_attempt = {**own_attempt, "user_id": "usr_another_student", "topic": "Private topic"}
        main.fallback_active_tests["own"] = own_attempt
        main.fallback_active_tests["other"] = other_attempt

        response = self.client.get("/api/tests/dashboard", headers=self.client_headers)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["overview"]["completed_count"], 1)
        self.assertEqual([item["topic"] for item in response.json()["topic_summary"]], ["Python"])

    def test_learning_plan_update_cannot_change_another_students_plan(self):
        main.fallback_learning_plans["usr_another_student"] = [
            {"tasks": [{"completed": False}]}
        ]

        response = self.client.put(
            "/api/tests/learning-plan",
            headers=self.client_headers,
            json={"task_index": 0, "completed": True},
        )

        self.assertEqual(response.status_code, 404)
        self.assertFalse(main.fallback_learning_plans["usr_another_student"][0]["tasks"][0]["completed"])

    def test_mongodb_learning_plan_completion_is_visible_after_reload(self):
        collection = FakeLearningPlanCollection("usr_abcdef123456")
        with patch.object(main, "mongo_client", FakeLearningPlanMongo(collection)), patch.object(main, "mongo_status", "connected"):
            updated = self.client.put(
                "/api/tests/learning-plan",
                headers=self.client_headers,
                json={"task_index": 0, "completed": True},
            )
            reloaded = self.client.get("/api/tests/learning-plan", headers=self.client_headers)

        self.assertEqual(updated.status_code, 200)
        self.assertEqual(reloaded.status_code, 200)
        self.assertTrue(reloaded.json()["learning_plan"]["tasks"][0]["completed"])

    def test_dashboard_requires_authenticated_student(self):
        with patch.object(main, "profile_for_request", new=AsyncMock(return_value=None)):
            response = self.client.get("/api/tests/dashboard", headers=self.client_headers)
        self.assertEqual(response.status_code, 401)

    def test_invalid_answer_is_rejected(self):
        with patch.object(main, "gemini_client", FakeClient()):
            generated = self.client.post("/api/tests/generate", headers=self.client_headers, json={"topic": "Python", "question_count": 5})
        response = self.client.post("/api/tests/submit", headers=self.client_headers, json={"test_id": generated.json()["test_id"], "answers": {"unknown": "A"}})
        self.assertEqual(response.status_code, 422)


if __name__ == "__main__":
    unittest.main()
