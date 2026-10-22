<<<<<<< HEAD
# Vaishu's AI Assistant

Student onboarding, authenticated profile-aware chat, backend-scored assessments, persistent learning plans, resume versioning, and separate progress dashboards. The application uses a static HTML/CSS/JavaScript frontend, FastAPI, and MongoDB. FastAPI serves the existing frontend and API from one origin; Render deploys both in one Web Service.

## Run locally (Windows PowerShell)

Start MongoDB first. In one terminal:

```powershell
Set-Location 'C:\Users\vaish\OneDrive\Documents\Vaishuscopilt\backend'
.\.venv\Scripts\Activate.ps1
uvicorn main:app --reload --host 127.0.0.1 --port 8080
```

Open `http://127.0.0.1:8080/` to create a profile or `http://127.0.0.1:8080/login.html` to sign in. FastAPI serves pages and API routes together, so browser requests use same-origin relative URLs; a separate port 5500 frontend server is no longer needed.

The backend loads configuration from `backend/.env`. `MONGODB_URI` is the preferred connection setting; `MONGODB_URL` remains accepted for older local `.env` files. Do not overwrite an existing `.env` with `.env.example`; copy only the settings you need, and keep all credentials backend-side.

## Authentication and profiles

New profiles require an email and a password of at least 12 characters. Passwords are stored as salted scrypt hashes. Onboarding creates a stable `usr_...` identifier and returns an opaque, persistent `HttpOnly`, `SameSite=Lax` cookie; it does not put the session secret in `localStorage` or return it to JavaScript. The backend stores only a SHA-256 hash of the session token, enforces `AUTH_SESSION_TTL_SECONDS` (7 days by default), and revokes it on sign-out. HTTPS deployments must set `AUTH_COOKIE_SECURE=true`.

Returning students use `POST /api/auth/login`; the cookie is sent with authenticated API requests and restores the profile after refresh, opening another tab, or restarting the browser until expiry. `GET /api/auth/session` returns the authenticated profile; `POST /api/auth/logout` revokes the active session. Supplying a profile ID is never sufficient for authentication, and an unauthenticated profile update for an existing email is rejected.

Profiles created before password authentication was added may not have a password hash. If that account still has a valid legacy session, open onboarding, set a password, and save to migrate it. If the old session has expired, this version has no email-based password-recovery service; do not claim ownership from an email or profile ID alone. Such an account needs a verified recovery process before it can be migrated.

Profiles are stored in `user_profiles` in the `krishna_ai_assistant` database. Resume uploads are parsed from text-based PDF/DOCX files and retained privately under `backend/uploads`; previous uploads and structured updates are versioned in `resume_versions`.

## Separate dashboard pages

Every page requires an authenticated session and loads student-specific data from FastAPI:

| Page | File | Data |
|---|---|---|
| Dashboard Home | `frontend/dashboard.html` | Latest and average scores, attempts, strengths, trends, next action |
| Skills Dashboard | `frontend/skills.html` | Profile/resume/assessed/verified evidence and role skill paths |
| Performance | `frontend/performance.html` | Saved attempt history and question-denominator topic analysis |
| Job Portal | `frontend/jobs.html` | Provider status, preferences, and real provider results only |
| Updated Resume | `frontend/resume.html` | Structured resume, evidence, and version history |
| Learning Calendar & Journey | `frontend/learning.html` | Topic tasks, revision plan, and student-configured schedule |
| Profile & Settings | `frontend/profile.html` | Authenticated profile details and sign-out |

The shared `frontend/dashboard.js` calls the existing `/api/tests/dashboard`, `/api/tests/skill-map`, `/api/tests/history`, `/api/tests/skills`, `/api/tests/learning-plan`, and `/api/users/{user_id}/resume` routes. Skills from a resume or profile are not treated as verified. Skill estimates require enough actual assessment questions and are product estimates, not validated proficiency measures.

Learning-topic task state is stored in `topic_learning_progress`; submitted tests and attempts use `learning_tests` and `assessment_attempts`; verified assessment evidence uses `skill_verifications`; revision tasks use `learning_plans`. A topic is not completed just by opening it: required tasks and a passing topic assessment are required. Calendar settings and dated task schedules are stored in `learning_calendars` and are derived from actual incomplete tasks. Students choose weekly study minutes and can mark or reschedule saved tasks.

## Resume updates

Onboarding accepts text-based PDF/DOCX resumes up to `RESUME_MAX_BYTES` (10 MB by default). Uploaded files are not overwritten. A skill can qualify for a structured resume addition only after the required learning topics and the relevant assessment criteria are met; the student must confirm the update. The resulting version preserves existing structured information, avoids duplicate skills, and records assessment evidence. Updated structured data and history are supported; PDF/DOCX generation and download are not currently implemented.

## Job portal and provider setup

The provider adapter uses Adzuna's documented search endpoint. Official documentation:

- API overview: <https://developer.adzuna.com/overview>
- Search API: <https://developer.adzuna.com/docs/search>
- Account/API credentials: <https://developer.adzuna.com/signup>

The Adzuna terms page could not be retrieved during implementation (HTTP 403). Therefore provider calls are disabled by default; review the current provider terms and confirm that your intended use is permitted before opting in. To enable after that review, set these values in `backend/.env`:

```env
ADZUNA_ENABLED=true
ADZUNA_APP_ID=your_app_id
ADZUNA_APP_KEY=your_app_key
ADZUNA_COUNTRY=in
```

Never put these credentials in frontend files. `GET /api/jobs/recommendations` and authenticated `POST /api/jobs/refresh` use the student's role/location preferences, validate provider application URLs, normalize supported Adzuna HTTP redirects to HTTPS, and show no placeholder listings. `PUT /api/jobs/preferences` saves the role, location, and remote preference.

Listings are limited to 10 per student per UTC day and cached in `job_recommendations`; matching provider queries are separately cached in `job_provider_cache`. There is no external scheduler in this project. The implemented fallback refreshes on the first authenticated request of the day and serves that day's cache afterward. It will not update during a sleeping/offline server period. If provider configuration is missing, the page explains setup is needed and returns an empty list.

## Gemini and assessment configuration

The Gemini key remains backend-only. Existing controls include `GEMINI_MAX_OUTPUT_TOKENS`, `CHAT_MAX_MESSAGE_CHARS`, `CHAT_MAX_HISTORY_MESSAGES`, `CHAT_MAX_CONTEXT_TOKENS`, `CHAT_MAX_REQUESTS`, `CHAT_RATE_LIMIT_WINDOW`, `CHAT_TIMEOUT_SECONDS`, and `GEMINI_MAX_RETRIES`. Normal scoring, pass/fail, dashboard calculations, learning task status, and job caching do not call Gemini.

Assessment pass score defaults to `PASSING_SCORE_PERCENTAGE=70`. Topic skill-level estimates use `MIN_TOPIC_QUESTIONS=2` and configurable bands `SKILL_LEVEL_DEVELOPING_MIN=50`, `SKILL_LEVEL_PROFICIENT_MIN=70`, and `SKILL_LEVEL_STRONG_MIN=85`. These are transparent product rules, not scientific proficiency measurements. Sample questions require development-only `ENABLE_MOCK_QUIZ=true` and are labeled in the UI.

## Tests and checks

Run backend tests:

```powershell
Set-Location 'C:\Users\vaish\OneDrive\Documents\Vaishuscopilt\backend'
.\.venv\Scripts\python.exe -m unittest discover -s . -p 'test_*.py'
```

Check all frontend JavaScript and UI navigation:

```powershell
Set-Location 'C:\Users\vaish\OneDrive\Documents\Vaishuscopilt'
Get-ChildItem .\frontend -Filter '*.js' | ForEach-Object {
    node --check $_.FullName
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
node --test .\frontend\test-navigation.test.js
node --test .\frontend\dashboard-pages.test.js
```

## Deploy on Render with MongoDB Atlas

The checked-in `render.yaml` describes one Render Web Service that serves the existing frontend and FastAPI endpoints from the same HTTPS origin. It installs `backend/requirements.txt`, starts `backend.main:app` on Render's assigned `PORT` (with 8080 as a local fallback), and checks `/health`. The service has a 1 GB persistent disk mounted at `/var/data`; resume uploads are stored in `/var/data/uploads` so they survive service restarts and deploys. A persistent disk requires a paid Render service plan. The service uses the existing Atlas database name `krishna_ai_assistant` and does not delete or recreate collections.

### 1. Prepare GitHub safely

Create an empty private GitHub repository in your browser. In VS Code, open a PowerShell terminal in the project root:

```powershell
Set-Location 'C:\Users\vaish\OneDrive\Documents\Vaishuscopilt'
git init -b main
git add .
git status --short
git status --short --ignored
```

Before committing, confirm `backend/.env`, `.venv`, `backend/uploads`, `uploads`, logs, and any database exports are ignored and are **not staged**. `backend/.env.example` is safe to commit because it contains placeholders. If a secret or private resume was staged, stop, unstage only that file with `git restore --staged <path>`, and check the ignore rules; if a secret was ever committed or pushed, rotate it before proceeding.

After confirming the staged file list:

```powershell
git commit -m "Prepare Vaishu AI Assistant for Render"
git remote add origin https://github.com/<YOUR_GITHUB_NAME>/<YOUR_REPOSITORY>.git
git push -u origin main
```

Use your own repository URL in the command. Do not put passwords, `MONGODB_URI`, or `GEMINI_API_KEY` in source files, commits, screenshots, or chat.

### 2. Create Atlas and preserve existing records

1. In MongoDB Atlas, create a project and cluster. Under **Database Access**, create a database user with a strong unique password (this is separate from your Atlas website login).
2. Under **Network Access**, allow the outbound IP addresses shown for your Render service. If your Render plan does not provide stable outbound addresses, consult the current Render/Atlas network options. A temporary `0.0.0.0/0` rule exposes the database endpoint to the internet and should only be used as a short-lived diagnostic with a strong database password; remove it promptly.
3. Select **Connect → Drivers** and copy the `mongodb+srv://` connection string. Put `krishna_ai_assistant` in its database path and URL-encode special characters in the database password. The format is `mongodb+srv://<DATABASE_USER>:<URL_ENCODED_PASSWORD>@<CLUSTER_HOST>/krishna_ai_assistant?retryWrites=true&w=majority`. Keep the complete URI private.
4. An Atlas cluster is separate from any existing local or other MongoDB server. If existing users and assessment records are only in another database, back up and restore the `krishna_ai_assistant` database before pointing the deployed app at Atlas. Install MongoDB Database Tools, then from the project root use:

   ```powershell
   Set-Location 'C:\Users\vaish\OneDrive\Documents\Vaishuscopilt'
   mongodump --uri 'mongodb://127.0.0.1:27017/krishna_ai_assistant' --out .\atlas-backup
   mongorestore --uri 'mongodb+srv://<DATABASE_USER>@<CLUSTER_HOST>/krishna_ai_assistant?retryWrites=true&w=majority' --password --nsInclude 'krishna_ai_assistant.*' .\atlas-backup\krishna_ai_assistant
   ```

   Replace the two placeholders with your URL-encoded Atlas database username and cluster host. `mongorestore` prompts for the database password; do not include it in the command. If the source database requires authentication or is not local, use its username-only connection URI with `--password` to prompt for its password as well. Restore to an empty Atlas database or confirm existing destination data before importing; do not add `--drop`. Verify collections and document counts in Atlas and keep the protected backup. The `atlas-backup` folder is gitignored. If your current app already uses the Atlas database, no migration is needed.
5. Existing uploaded resume files are stored on disk rather than inside MongoDB. The Render disk starts empty. If existing profile records refer to resume files that are only on your computer, back them up and transfer those files to the Render disk's `uploads` directory using a secure method before relying on those old file references. MongoDB records are not altered by deployment.

### 3. Create and configure the Render service

1. In Render, choose **New → Blueprint** (or create a Web Service), connect the GitHub repository, and select the `main` branch. Review the detected `render.yaml`. It deploys only on Render and adds a persistent disk for uploaded resumes.
2. If the service name was changed from `vaishu-ai-assistant`, update the `FRONTEND_ORIGINS` value in the Blueprint to the actual `https://<service-name>.onrender.com` URL. Frontend API requests are same-origin; this value is for any browser clients hosted on that allowed origin.
3. In the Render service **Environment** settings, add:
   - `MONGODB_URI`: the private Atlas connection string from the preceding step.
   - `GEMINI_API_KEY`: your Google Gemini API key.
4. Keep `MONGODB_DATABASE=krishna_ai_assistant`, `AUTH_COOKIE_SECURE=true`, and `UPLOAD_DIR=/var/data/uploads` as declared in `render.yaml`. Never add either secret as a frontend environment variable.
5. Deploy. Render runs the build command `python -m pip install -r backend/requirements.txt` and start command `uvicorn main:app --app-dir backend --host 0.0.0.0 --port ${PORT:-8080}`. Wait for the `/health` check to pass. The public Render URL serves onboarding at `/`, sign-in at `/login.html`, and all API routes under `/api/`.

### 4. Verify the live deployment

1. Open the root Render URL. Create a test account using an email/password you control, then sign out and sign in again.
2. Open the AI Assistant and send a question. Confirm it receives a Gemini response with the signed-in student's profile context. A Gemini quota or credential error should be reported without exposing the key.
3. Generate and submit an assessment. Check results, refresh the dashboard, and confirm the saved attempt appears.
4. Confirm profile, assessment, and learning-plan data remain after page refresh and a later sign-in. If safe to do so, use a second test account and verify that it cannot access the first account's data.
5. Upload a test resume only if desired. Confirm the upload and parsed profile are visible; persistent disk storage preserves the file across deploys.
6. Visit `<RENDER_URL>/health`; a healthy deployment responds with `{"status":"ok","database":"connected",...}`. Do not publish health-check logs containing connection details.

### Troubleshooting

- **404 at `/` or a page:** confirm the deployment uses the repository root, `render.yaml`, and `backend/main.py`; inspect Render build/deploy logs. Static pages such as `/login.html` and assets such as `/app.js` are served by FastAPI.
- **500 or `/health` returns 503:** confirm the service environment has `MONGODB_URI`, the database path is `krishna_ai_assistant`, the Atlas database user/password are correct, and Render outbound addresses are in the Atlas IP access list. URL-encode reserved password characters. Use Render logs for diagnosis but redact credentials before sharing them.
- **CORS errors:** use the single Render URL for both page and API. If a separate browser origin is intentionally used, set `FRONTEND_ORIGINS` to that exact HTTPS origin and redeploy; do not use `*` with credentialed requests.
- **Chat or AI test generation fails:** check that `GEMINI_API_KEY` is set in Render (not in browser files), the key is active, the selected model is available, and the project has quota. Gemini rate limits are temporary; wait and retry. Basic scoring and saved dashboard calculations do not require Gemini.
- **Uploads disappear or resume file paths fail:** verify the Render disk is attached at `/var/data` and `UPLOAD_DIR` is `/var/data/uploads`. MongoDB stores profile/resume metadata; the disk stores uploaded file bytes.
- **Old user data is missing:** deployment does not automatically copy a local database into Atlas. Verify the source database name and collection counts, then migrate/restore the existing `krishna_ai_assistant` data to Atlas without dropping the source.
=======
# Vaishu-sCopilot
Student onboarding ai chatbot , assessments, resume versioning, and separate progress dashboards.
>>>>>>> 79f9a75a7fccecc02b29e6b3f04f13449dd7d5c6
