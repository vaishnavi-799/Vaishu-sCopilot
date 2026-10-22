# Vaishu's AI Assistant

### A Profile-Aware AI Learning, Assessment, and Career Guidance Platform
🔗 **Live Demo:** [https://vaishu-scopilot.onrender.com](https://vaishu-scopilot.onrender.com)

Vaishu's AI Assistant is a full-stack web application designed to help
students maintain a personalized learning profile, ask profile-aware
questions, take assessments, track learning progress, manage resume
versions, and explore job recommendations.

The application combines a static HTML/CSS/JavaScript frontend, a
FastAPI backend, MongoDB persistence, and Google Gemini for AI-powered
chat. The frontend and API are served from the same origin, making local
development and Render deployment simpler.

> **Project accuracy note:** This README documents the features and
> configuration described by the current project documentation. Skill
> estimates are product rules rather than scientifically validated
> proficiency measurements. Resume updates currently save structured
> resume data and version history; PDF/DOCX generation and download are
> not implemented. Job-provider calls are disabled by default until
> Adzuna terms and intended use have been reviewed.

------------------------------------------------------------------------

## Table of contents

1.  [Project overview](#1-project-overview)
2.  [Problem statement and
    objectives](#2-problem-statement-and-objectives)
3.  [Main features](#3-main-features)
4.  [Technology stack](#4-technology-stack)
5.  [Architecture](#5-architecture)
6.  [Application workflows](#6-application-workflows)
7.  [Authentication and security](#7-authentication-and-security)
8.  [Database design](#8-database-design)
9.  [Feature explanations](#9-feature-explanations)
10. [Pages and dashboards](#10-pages-and-dashboards)
11. [API reference](#11-api-reference)
12. [Configuration reference](#12-configuration-reference)
13. [Run locally on Windows](#13-run-locally-on-windows)
14. [Run tests and checks](#14-run-tests-and-checks)
15. [Deploy on Render with MongoDB
    Atlas](#15-deploy-on-render-with-mongodb-atlas)
16. [Troubleshooting](#16-troubleshooting)
17. [Limitations and future
    improvements](#17-limitations-and-future-improvements)
18. [Placement and interview
    preparation](#18-placement-and-interview-preparation)
19. [Glossary](#19-glossary)

------------------------------------------------------------------------

## 1. Project overview

Aishu's AI Assistant brings together student profile management, an AI
chat assistant, assessments, learning tasks, dashboards, resume
versioning, and a job portal.

### What problem does it solve?

Students often keep learning progress, assessment results, resume
information, and career goals in separate places. This application
provides one place to store student-specific information and use it to
support learning and career planning.

### High-level capabilities

-   Create an account and sign in using an email and password.
-   Keep a persistent authenticated session using a secure cookie.
-   Ask the AI assistant questions with the signed-in student's profile
    context.
-   Generate and submit assessments, then save results and attempt
    history.
-   Review score trends, skill evidence, and topic-level progress.
-   Store learning tasks and a configurable study schedule.
-   Upload text-based PDF/DOCX resumes and maintain resume versions.
-   Save job-search preferences and optionally retrieve real provider
    listings through Adzuna.
-   Keep student data in MongoDB and uploaded resume files in private
    server-side storage.

------------------------------------------------------------------------

## 2. Problem statement and objectives

### Problem statement

Students need a convenient way to connect their profile, learning
activities, assessment evidence, resume information, and career
preferences. Without a central system, it is difficult to review
progress over time and decide what to study next.

### Objectives

1.  **Personalization:** use the authenticated student's profile as
    context for supported assistant features.
2.  **Assessment tracking:** save submitted tests and attempts so
    results can be reviewed later.
3.  **Progress visibility:** present score history, topic analysis, and
    learning tasks in separate dashboards.
4.  **Evidence-aware skill tracking:** distinguish skills mentioned in a
    profile or resume from skills supported by assessment evidence.
5.  **Resume versioning:** preserve structured resume information and
    record confirmed updates rather than overwriting previous uploads.
6.  **Career exploration:** store role/location preferences and support
    an optional provider integration for job listings.
7.  **Security:** avoid treating a profile ID alone as proof of identity
    and keep credentials and API keys on the backend.

------------------------------------------------------------------------

## 3. Main features

  -----------------------------------------------------------------------
  Feature                             What it does
  ----------------------------------- -----------------------------------
  Student onboarding                  Creates a profile and stable
                                      student identifier

  Login and logout                    Authenticates returning students
                                      and revokes sessions on logout

  Profile-aware chat                  Sends supported chat requests
                                      through FastAPI to Gemini with
                                      profile context

  Assessments                         Supports assessment
                                      generation/submission and backend
                                      scoring

  Performance dashboard               Shows saved attempts, score
                                      summaries, trends, and topic
                                      analysis

  Skills dashboard                    Separates profile/resume
                                      information from assessment-based
                                      evidence

  Learning plan                       Stores topic tasks, progress, and
                                      revision tasks

  Learning calendar                   Builds a schedule from incomplete
                                      tasks and student-configured study
                                      time

  Resume uploads                      Parses text-based PDF/DOCX resumes
                                      and stores uploads privately

  Resume versioning                   Stores structured resume updates
                                      and version history

  Job portal                          Saves preferences and can retrieve
                                      provider results when explicitly
                                      configured

  Persistent storage                  Stores profiles, attempts, learning
                                      progress, and related records in
                                      MongoDB
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 4. Technology stack

  -----------------------------------------------------------------------
  Technology                          Role in the project
  ----------------------------------- -----------------------------------
  HTML                                Page structure and forms

  CSS                                 Layout, styling, and responsive
                                      presentation

  JavaScript                          Frontend interaction, form
                                      handling, API requests, and
                                      dashboard rendering

  Python                              Backend application logic

  FastAPI                             HTTP API, request validation,
                                      routing, and frontend serving

  MongoDB                             Persistent document database

  Google Gemini                       AI-powered chat and supported AI
                                      generation features

  Adzuna API                          Optional external job-search
                                      provider

  Render                              Hosting for the web service

  MongoDB Atlas                       Managed MongoDB deployment

  `unittest`                          Backend test execution

  Node.js test runner                 Frontend JavaScript checks and
                                      navigation/dashboard tests
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 5. Architecture

### 5.1 System architecture

``` mermaid
flowchart TD
    Student[Student in browser]
    UI[HTML / CSS / JavaScript frontend]
    API[FastAPI application]
    Auth[Authentication and session checks]
    Logic[Profile, chat, assessment, learning and resume logic]
    DB[(MongoDB)]
    Files[(Private resume file storage)]
    Gemini[Google Gemini API]
    Adzuna[Adzuna job API - optional]

    Student --> UI
    UI -->|Same-origin HTTP requests| API
    API --> Auth
    Auth --> Logic
    Logic <--> DB
    Logic <--> Files
    Logic -->|AI chat / supported generation| Gemini
    Logic -->|Only when enabled and configured| Adzuna
    API -->|HTML pages, JavaScript, CSS, API responses| UI
```

**How to read the diagram**

1.  The student uses the browser-based frontend.
2.  The frontend sends requests to FastAPI using same-origin URLs.
3.  FastAPI validates requests and checks the session for protected
    operations.
4.  Application logic reads or writes MongoDB records and, where needed,
    private resume files.
5.  Gemini is called for AI-powered functionality. Ordinary score
    calculation, pass/fail decisions, dashboard calculations, learning
    task status, and job caching do not require Gemini.
6.  Adzuna is optional and disabled by default until its terms and
    intended use are reviewed.

### 5.2 Request/response architecture

``` mermaid
sequenceDiagram
    actor Student
    participant Browser as Frontend
    participant API as FastAPI
    participant DB as MongoDB
    Student->>Browser: Submit form or click action
    Browser->>API: HTTP request
    API->>API: Validate request and session
    API->>DB: Read or update required records
    DB-->>API: Result
    API-->>Browser: JSON response or page
    Browser-->>Student: Update the interface
```

This is the normal application flow. AI chat and external job-provider
requests add an external service call where appropriate.

### 5.3 Deployment architecture

``` mermaid
flowchart LR
    GitHub[GitHub repository]
    Render[Render Web Service]
    FastAPI[FastAPI + static frontend]
    Atlas[(MongoDB Atlas)]
    Disk[(Render persistent disk)]
    Gemini[Gemini API]
    Adzuna[Adzuna API - optional]

    GitHub -->|Deploy from main branch| Render
    Render --> FastAPI
    FastAPI <--> Atlas
    FastAPI <--> Disk
    FastAPI --> Gemini
    FastAPI -. Optional provider integration .-> Adzuna
```

The supplied `render.yaml` describes a single Render Web Service that
serves the frontend and API from one HTTPS origin. The persistent disk
is configured for uploaded resume files. Render persistent disks require
a paid service plan according to the current project documentation.

------------------------------------------------------------------------

## 6. Application workflows

### 6.1 New student onboarding

``` mermaid
flowchart TD
    A[Open onboarding page] --> B[Enter profile details and credentials]
    B --> C[Frontend sends request to FastAPI]
    C --> D{Input valid?}
    D -- No --> E[Return validation error]
    D -- Yes --> F[Hash password with scrypt]
    F --> G[Create student profile in MongoDB]
    G --> H[Create session and set HttpOnly cookie]
    H --> I[Open authenticated application]
```

The backend creates a stable `usr_...` identifier. The session token is
stored in an `HttpOnly` cookie; the session secret is not placed in
`localStorage` or returned to JavaScript.

### 6.2 Returning-student login

``` mermaid
sequenceDiagram
    actor Student
    participant UI as Login page
    participant API as FastAPI
    participant DB as MongoDB
    Student->>UI: Enter email and password
    UI->>API: POST /api/auth/login
    API->>DB: Find account and password hash
    DB-->>API: Account data
    API->>API: Verify password and create session
    API-->>UI: Set session cookie
    UI->>API: GET /api/auth/session
    API-->>UI: Authenticated profile
```

After login, the browser sends the cookie with authenticated API
requests. The session can restore the profile after a page refresh or
browser restart until the session expires or is revoked.

### 6.3 Assessment and progress tracking

``` mermaid
flowchart TD
    A[Student opens assessment] --> B[Request assessment]
    B --> C[Answer questions]
    C --> D[Submit answers to backend]
    D --> E[Backend calculates score]
    E --> F{Score meets passing rule?}
    F -- Yes --> G[Record passing result and eligible evidence]
    F -- No --> H[Record attempt and result]
    G --> I[Save attempt and related progress]
    H --> I
    I --> J[Refresh dashboard and history]
```

The default passing threshold is 70%. The exact eligibility rules for
topic completion and skill evidence are application rules, not a formal
external certification.

### 6.4 Resume update workflow

``` mermaid
flowchart TD
    A[Upload text-based PDF or DOCX] --> B[Validate file and size]
    B --> C[Parse supported resume text]
    C --> D[Store file privately and record version]
    D --> E[Student completes required learning and assessment criteria]
    E --> F[Prepare structured resume update]
    F --> G[Ask student to confirm]
    G -->|Confirm| H[Save updated structured version]
    G -->|Decline| I[Keep current version]
    H --> J[Record version history and evidence]
```

Uploaded files are not overwritten. The documented default maximum
upload size is 10 MB. PDF/DOCX generation and download are not currently
implemented.

### 6.5 Job recommendations

1.  The authenticated student saves a preferred role, location, and
    remote-work preference.
2.  The backend checks whether the provider is enabled and credentials
    are configured.
3.  If enabled, it queries the Adzuna search API, validates application
    URLs, and normalizes supported redirects to HTTPS.
4.  Results are cached, with a limit of 10 listings per student per UTC
    day.
5.  If provider configuration is missing, the page explains that setup
    is required and returns no placeholder listings.

There is no external scheduler. The documented refresh fallback runs on
the first authenticated request of the day and then serves that day's
cache.

------------------------------------------------------------------------

## 7. Authentication and security

### 7.1 Authentication concepts used

-   **Authentication:** verifies that the person signing in owns the
    account credentials.
-   **Authorization:** checks whether the authenticated session is
    permitted to access a protected operation or resource.
-   **Session:** server-recognized state that keeps the user signed in
    between requests.
-   **Password hashing:** stores a one-way password hash rather than the
    original password.
-   **Cookie:** browser-managed value sent with matching requests. An
    `HttpOnly` cookie cannot be read by ordinary frontend JavaScript.

### 7.2 Implemented protections described in the project documentation

-   Passwords are stored as salted `scrypt` hashes.
-   New account passwords must be at least 12 characters long.
-   Session tokens are returned through an opaque `HttpOnly`,
    `SameSite=Lax` cookie.
-   The database stores a SHA-256 hash of the session token rather than
    the raw session token.
-   Sessions expire after `AUTH_SESSION_TTL_SECONDS` (7 days by
    default).
-   Logout revokes the active session.
-   Supplying a profile ID alone does not authenticate a user.
-   An unauthenticated update for an existing email is rejected.
-   Gemini and Adzuna credentials remain on the backend.
-   Resume uploads are stored privately on the server, not as public
    frontend assets.

### 7.3 Production security checklist

-   Set `AUTH_COOKIE_SECURE=true` when serving over HTTPS.
-   Store `MONGODB_URI` and `GEMINI_API_KEY` in Render's private
    environment settings.
-   Never commit `.env`, API keys, database passwords, private resumes,
    or database exports.
-   Use a strong, unique MongoDB database-user password.
-   Restrict MongoDB Atlas network access to the narrowest supported set
    of Render outbound addresses. Avoid leaving `0.0.0.0/0` enabled.
-   Keep dependencies updated and review provider terms before enabling
    external job requests.
-   Do not share unredacted logs, connection strings, session cookies,
    or API keys when debugging.

### 7.4 Legacy accounts

Older profiles may not have a password hash. If a legacy session is
still valid, the documented migration path is to open onboarding, set a
password, and save. If the session has expired, this version does not
provide email-based password recovery. An account should not be migrated
based only on an email address or profile ID; a verified recovery
process is needed.

------------------------------------------------------------------------

## 8. Database design

MongoDB stores related application data in collections. The documented
database name is `krishna_ai_assistant`.

### 8.1 Main collections

  Collection                  Purpose described in the project
  --------------------------- -----------------------------------------------
  `user_profiles`             Student profile and account-related data
  `resume_versions`           Structured resume updates and version history
  `topic_learning_progress`   Learning-topic task state
  `learning_tests`            Submitted tests / test records
  `assessment_attempts`       Assessment attempts and results
  `skill_verifications`       Assessment-based skill evidence
  `learning_plans`            Revision and learning tasks
  `learning_calendars`        Calendar preferences and dated task schedules
  `job_recommendations`       Cached job listings per student/day
  `job_provider_cache`        Cached provider-query results

The exact document fields and indexes should be confirmed from the
current backend models and database code; this README does not invent a
schema for fields not documented here.

### 8.2 Conceptual data relationships

``` mermaid
erDiagram
    USER_PROFILE ||--o{ RESUME_VERSION : has
    USER_PROFILE ||--o{ ASSESSMENT_ATTEMPT : makes
    USER_PROFILE ||--o{ TOPIC_PROGRESS : tracks
    USER_PROFILE ||--o{ SKILL_VERIFICATION : earns
    USER_PROFILE ||--o{ LEARNING_PLAN : follows
    USER_PROFILE ||--o{ LEARNING_CALENDAR : configures
    USER_PROFILE ||--o{ JOB_RECOMMENDATION : receives

    USER_PROFILE {
        string user_id
        string email
    }
    RESUME_VERSION {
        string version_id
        string user_id
    }
    ASSESSMENT_ATTEMPT {
        string attempt_id
        string user_id
        number score
    }
    TOPIC_PROGRESS {
        string user_id
        string topic
        string status
    }
```

This is a **conceptual** relationship diagram, not a complete physical
schema. MongoDB collections may contain additional fields and
identifiers.

### 8.3 Database and file storage are different

-   MongoDB stores profiles, assessment records, learning progress,
    resume metadata/version information, and job caches.
-   Resume file bytes are stored separately under the configured upload
    directory.
-   On Render, the persistent disk is mounted at `/var/data`, with
    uploads configured at `/var/data/uploads`.
-   Deploying the app does not automatically copy a local database or
    local resume files to Atlas/Render. Migrate them deliberately if
    required.

------------------------------------------------------------------------

## 9. Feature explanations

### 9.1 Profile-aware AI chat

The frontend sends a chat request to the backend. The backend applies
request limits and context limits, uses the authenticated student's
profile context where supported, and calls Gemini. The Gemini key is
kept server-side.

Configuration controls documented for chat include:

-   `GEMINI_MAX_OUTPUT_TOKENS`
-   `CHAT_MAX_MESSAGE_CHARS`
-   `CHAT_MAX_HISTORY_MESSAGES`
-   `CHAT_MAX_CONTEXT_TOKENS`
-   `CHAT_MAX_REQUESTS`
-   `CHAT_RATE_LIMIT_WINDOW`
-   `CHAT_TIMEOUT_SECONDS`
-   `GEMINI_MAX_RETRIES`

AI responses can be affected by model availability, quota, network
conditions, and prompt context. Do not treat an AI answer as a
guaranteed factual result.

### 9.2 Assessment scoring and skill evidence

The backend scores submitted answers and saves attempts. The default
passing score is configured by `PASSING_SCORE_PERCENTAGE=70`.

Topic-level skill estimates require at least `MIN_TOPIC_QUESTIONS=2` by
default. The documented default bands are:

-   Developing: 50% and above
-   Proficient: 70% and above
-   Strong: 85% and above

The configured bands are product rules. They are not validated
scientific measures of a student's overall ability. Skills found in a
resume or profile are not automatically treated as verified skills.

Mock/sample questions require `ENABLE_MOCK_QUIZ=true` and are labeled in
the UI. Keep this development-only behavior clearly identified.

### 9.3 Learning plan and calendar

The learning plan tracks topic tasks and revision tasks. Opening a topic
alone does not mark it complete. The documented rules require the
necessary tasks and a passing topic assessment. Students can choose
weekly study minutes and mark or reschedule saved tasks. Calendar dates
are derived from actual incomplete tasks and the student's schedule
settings.

### 9.4 Resume parsing and versioning

The app accepts text-based PDF and DOCX resumes up to the configured
file-size limit. It parses available text, stores the original upload
privately, and keeps version history. A structured resume addition can
qualify only after the required learning topics and assessment criteria
are met, and the student must confirm the update.

**Current limitation:** structured data and version history are
supported, but generating or downloading a newly formatted PDF/DOCX
resume is not currently implemented.

### 9.5 Job portal

The job portal stores role, location, and remote preferences. Adzuna
integration is optional and disabled by default. Before enabling it,
review the provider's current terms and confirm that the intended use is
allowed. The backend should remain the only place that holds provider
credentials.

------------------------------------------------------------------------

## 10. Pages and dashboards

The project documentation identifies these frontend pages:

  -----------------------------------------------------------------------------
  Page                    File                          Main purpose
  ----------------------- ----------------------------- -----------------------
  Dashboard Home          `frontend/dashboard.html`     Latest/average scores,
                                                        attempts, strengths,
                                                        trends, next action

  Skills Dashboard        `frontend/skills.html`        Profile, resume,
                                                        assessed and verified
                                                        evidence, role skill
                                                        paths

  Performance             `frontend/performance.html`   Saved attempt history
                                                        and topic analysis

  Job Portal              `frontend/jobs.html`          Provider status,
                                                        preferences, real
                                                        provider results

  Updated Resume          `frontend/resume.html`        Structured resume,
                                                        evidence, and version
                                                        history

  Learning Calendar &     `frontend/learning.html`      Topic tasks, revision
  Journey                                               plan, schedule

  Profile & Settings      `frontend/profile.html`       Authenticated profile
                                                        and sign-out
  -----------------------------------------------------------------------------

The shared `frontend/dashboard.js` is documented as calling these
routes:

-   `/api/tests/dashboard`
-   `/api/tests/skill-map`
-   `/api/tests/history`
-   `/api/tests/skills`
-   `/api/tests/learning-plan`
-   `/api/users/{user_id}/resume`

All listed dashboard pages require an authenticated session and load
student-specific information through FastAPI.

------------------------------------------------------------------------

## 11. API reference

FastAPI's interactive API documentation is available locally at
`http://127.0.0.1:8080/docs` and at `<RENDER_URL>/docs` after
deployment, if API docs are enabled by the application.

The table below includes routes explicitly identified in the current
project README. It is **not guaranteed to be the complete API
inventory**; inspect `/docs` or the backend route definitions for all
request fields, response schemas, and error codes.

  -------------------------------------------------------------------------------
  Method                  Route                           Purpose
  ----------------------- ------------------------------- -----------------------
  `GET`                   `/health`                       Health check; reports
                                                          application/database
                                                          status

  `POST`                  `/api/auth/login`               Authenticate a
                                                          returning student

  `GET`                   `/api/auth/session`             Return the current
                                                          authenticated
                                                          profile/session

  `POST`                  `/api/auth/logout`              Revoke the active
                                                          session

  `GET`                   `/api/tests/dashboard`          Dashboard summary data

  `GET`                   `/api/tests/skill-map`          Skill-map data

  `GET`                   `/api/tests/history`            Saved assessment
                                                          history

  `GET`                   `/api/tests/skills`             Skill/evidence data

  `GET`                   `/api/tests/learning-plan`      Learning-plan data

  `GET`                   `/api/users/{user_id}/resume`   Resume information for
                                                          the specified user,
                                                          subject to backend
                                                          authorization

  `GET`                   `/api/jobs/recommendations`     Read job
                                                          recommendations

  `POST`                  `/api/jobs/refresh`             Refresh job results
                                                          when provider
                                                          integration is
                                                          configured

  `PUT`                   `/api/jobs/preferences`         Save job
                                                          role/location/remote
                                                          preferences
  -------------------------------------------------------------------------------

Other onboarding, chat, assessment-generation, assessment-submission,
and resume-upload routes may exist. Use the live FastAPI docs or backend
route code to document their exact methods and schemas rather than
guessing them.

### Example health check

Open this URL in a browser:

``` text
http://127.0.0.1:8080/health
```

A healthy response is documented to resemble:

``` json
{
  "status": "ok",
  "database": "connected"
}
```

The application may include additional response fields.

------------------------------------------------------------------------

## 12. Configuration reference

Configuration is loaded from `backend/.env` locally. The project
documentation prefers `MONGODB_URI`; `MONGODB_URL` is also accepted for
older local configuration.

### Example `.env.example`

Use placeholders only. Do not paste real credentials into this file.

``` dotenv
# MongoDB
MONGODB_URI=mongodb://127.0.0.1:27017/krishna_ai_assistant
MONGODB_DATABASE=krishna_ai_assistant
MONGODB_COLLECTION=user_profiles

# AI provider - keep the real key private
GEMINI_API_KEY=replace_with_your_key
GEMINI_MODEL=gemini-2.5-flash

# Authentication
AUTH_SESSION_TTL_SECONDS=604800
AUTH_COOKIE_SECURE=false

# Frontend origin(s) allowed by the backend
FRONTEND_ORIGINS=http://127.0.0.1:8080,http://localhost:8080

# Resume storage and upload size
UPLOAD_DIR=uploads
RESUME_MAX_BYTES=10485760

# Assessment configuration
PASSING_SCORE_PERCENTAGE=70
MIN_TOPIC_QUESTIONS=2
SKILL_LEVEL_DEVELOPING_MIN=50
SKILL_LEVEL_PROFICIENT_MIN=70
SKILL_LEVEL_STRONG_MIN=85
ENABLE_MOCK_QUIZ=false

# Optional Adzuna integration (disabled until reviewed)
ADZUNA_ENABLED=false
ADZUNA_APP_ID=
ADZUNA_APP_KEY=
ADZUNA_COUNTRY=in
```

**Important:** this is a template based on documented configuration
names, not a replacement for the project's existing `.env.example`.
Check `backend/main.py`, settings/configuration modules, and
`render.yaml` for required values and defaults before changing your
working environment. Do not overwrite a working `.env` blindly.

### Configuration notes

-   Use the MongoDB URI that matches your actual database deployment.
-   URL-encode special characters in the MongoDB database password.
-   On HTTPS production deployments, set `AUTH_COOKIE_SECURE=true`.
-   Keep `GEMINI_API_KEY`, MongoDB credentials, and Adzuna credentials
    backend-side.
-   On Render, set `UPLOAD_DIR=/var/data/uploads` when using the
    configured persistent disk.
-   Set mock quiz mode only when intentionally using development sample
    questions.

------------------------------------------------------------------------

## 13. Run locally on Windows

### Prerequisites

Install or prepare:

-   Python version compatible with `backend/requirements.txt`
-   MongoDB local service or a MongoDB Atlas database
-   Node.js for frontend syntax checks and Node test commands
-   Git, if you plan to clone/push the repository

### Step 1: Open the project in VS Code

Open the project folder:

``` text
C:\Users\vaish\OneDrive\Documents\Vaishuscopilt
```

Open the integrated terminal and select PowerShell.

### Step 2: Create/activate the Python virtual environment

If `.venv` already exists:

``` powershell
Set-Location 'C:\Users\vaish\OneDrive\Documents\Vaishuscopilt\backend'
.\.venv\Scripts\Activate.ps1
```

If the virtual environment does not exist yet:

``` powershell
Set-Location 'C:\Users\vaish\OneDrive\Documents\Vaishuscopilt\backend'
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

If PowerShell blocks virtual-environment activation, you can run the
environment's Python executable directly rather than changing
system-wide execution policy.

### Step 3: Configure environment variables

Create or edit `backend/.env` using the settings required by the
project. Use `backend/.env.example` as a guide if it exists. Confirm
that `.env` is ignored by Git:

``` powershell
git check-ignore backend/.env
```

The command should print the ignored path. If it does not, stop before
committing and fix `.gitignore`.

### Step 4: Start the backend

``` powershell
Set-Location 'C:\Users\vaish\OneDrive\Documents\Vaishuscopilt\backend'
.\.venv\Scripts\Activate.ps1
uvicorn main:app --reload --host 127.0.0.1 --port 8080
```

If the shell cannot find `uvicorn`, install dependencies from
`requirements.txt` in the active virtual environment.

### Step 5: Open the application

-   Onboarding: `http://127.0.0.1:8080/`
-   Login: `http://127.0.0.1:8080/login.html`
-   API documentation: `http://127.0.0.1:8080/docs`
-   Health check: `http://127.0.0.1:8080/health`

The backend serves the existing frontend and API from one origin. A
separate frontend server on port 5500 is not required for the documented
setup.

------------------------------------------------------------------------

## 14. Run tests and checks

Run these commands from PowerShell.

### 14.1 Backend unit tests

``` powershell
Set-Location 'C:\Users\vaish\OneDrive\Documents\Vaishuscopilt\backend'
.\.venv\Scripts\python.exe -m unittest discover -s . -p 'test_*.py'
```

This discovers files matching `test_*.py` in the backend directory.

### 14.2 Check frontend JavaScript syntax

``` powershell
Set-Location 'C:\Users\vaish\OneDrive\Documents\Vaishuscopilt'
Get-ChildItem .\frontend -Filter '*.js' | ForEach-Object {
    node --check $_.FullName
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
```

### 14.3 Frontend navigation/dashboard tests

``` powershell
Set-Location 'C:\Users\vaish\OneDrive\Documents\Vaishuscopilt'
node --test .\frontend\test-navigation.test.js
node --test .\frontend\dashboard-pages.test.js
```

Run the checks after changes and inspect the test output. A command
completing without an error is useful evidence, but it does not replace
manual testing of login, authorization, assessment submission, uploads,
and data persistence.

------------------------------------------------------------------------

## 15. Deploy on Render with MongoDB Atlas

The project documentation describes a single Render Web Service
configured by `render.yaml`. Review the actual file in the repository
before deploying.

### 15.1 Prepare the repository safely

Create a private GitHub repository, then run from the project root:

``` powershell
Set-Location 'C:\Users\vaish\OneDrive\Documents\Vaishuscopilt'
git init -b main
git add .
git status --short
git status --short --ignored
```

Before committing, confirm that these are not staged:

-   `backend/.env`
-   `.venv`
-   `backend/uploads` and other private uploads
-   logs
-   database exports/backups
-   API keys, passwords, session secrets, or other credentials

`backend/.env.example` can be committed only if it contains
placeholders, not real secrets.

Then commit and push, replacing the repository URL with your own:

``` powershell
git commit -m "Prepare Aishu AI Assistant for deployment"
git remote add origin https://github.com/<YOUR_GITHUB_NAME>/<YOUR_REPOSITORY>.git
git push -u origin main
```

If the remote repository already has commits, first inspect and
reconcile the histories safely. Do not use `git push --force` as a
shortcut.

### 15.2 Configure MongoDB Atlas

1.  Create/select an Atlas project and cluster.
2.  Create a dedicated database user under **Database Access**.
3.  Under **Network Access**, allow the Render service's outbound
    addresses where possible.
4.  Copy the MongoDB driver connection string.
5.  Set the database path to `krishna_ai_assistant` and URL-encode
    special characters in the password.
6.  Keep the full URI private.

Example format only:

``` text
mongodb+srv://<DATABASE_USER>:<URL_ENCODED_PASSWORD>@<CLUSTER_HOST>/krishna_ai_assistant?retryWrites=true&w=majority
```

Atlas is separate from a local MongoDB instance. If the existing records
are stored elsewhere, back them up and migrate them intentionally before
switching the deployed app to Atlas. Do not drop existing destination
collections without confirming the data and backup.

Resume file bytes are stored outside MongoDB. Existing profile records
may refer to files on your computer; those files must be transferred
securely if they are needed on the deployed service.

### 15.3 Configure Render

1.  Open Render and select **New → Blueprint**, or create a Web Service.
2.  Connect the GitHub repository and select the deployment branch.
3.  Review the detected `render.yaml`, build command, start command,
    health-check path, and disk configuration.
4.  Set private environment variables in the Render service settings:
    -   `MONGODB_URI` --- the private Atlas connection string
    -   `GEMINI_API_KEY` --- your active Gemini API key
5.  Keep the documented production values consistent with the actual
    `render.yaml`, including:
    -   `MONGODB_DATABASE=krishna_ai_assistant`
    -   `AUTH_COOKIE_SECURE=true`
    -   `UPLOAD_DIR=/var/data/uploads`
6.  Deploy and inspect the logs. Do not publish logs that contain
    credentials or connection details.

The documented deployment command is equivalent to:

``` bash
python -m pip install -r backend/requirements.txt
uvicorn main:app --app-dir backend --host 0.0.0.0 --port ${PORT:-8080}
```

The service should serve the onboarding page at `/`, the login page at
`/login.html`, and API routes under `/api/`. The configured health-check
route is `/health`.

### 15.4 Verify the deployment

After deployment:

1.  Open the Render URL and create a test account.
2.  Sign out and sign in again.
3.  Send a question to the assistant and verify that a response is
    returned.
4.  Generate and submit an assessment; confirm the saved attempt appears
    in the dashboard/history.
5.  Refresh the browser and sign in again to verify persistence.
6.  If practical, use a second test account to check that it cannot
    access the first student's private data.
7.  Optionally upload a test resume and verify that the parsed data and
    upload are available.
8.  Open `<RENDER_URL>/health` and confirm the service reports healthy
    database connectivity.

A Render deployment does not automatically migrate a local database or
local resume files. Verify both storage locations before declaring
migration complete.

------------------------------------------------------------------------

## 16. Troubleshooting

  -----------------------------------------------------------------------
  Problem                             Checks and possible fix
  ----------------------------------- -----------------------------------
  `/` or `/login.html` returns 404    Confirm the deployed service uses
                                      the expected repository root,
                                      `render.yaml`, and
                                      `backend/main.py`. Check Render
                                      logs and static-file routing.

  `/health` returns 503 or the app    Check `MONGODB_URI`, database name,
  returns 500                         database-user credentials,
                                      URL-encoded password characters,
                                      Atlas network access, and Render
                                      logs. Redact secrets before sharing
                                      logs.

  MongoDB connection fails            Confirm the URI points to the
                                      intended cluster/database, the
                                      database user is correct, and the
                                      deployment can reach Atlas.

  Login does not persist after        Check cookie settings, browser
  refresh                             cookie behavior, session expiry,
                                      HTTPS configuration, and
                                      `/api/auth/session`.

  CORS error                          Prefer the single Render origin for
                                      frontend and API. If using a
                                      separate origin, configure the
                                      exact allowed origin; do not use
                                      `*` with credentialed requests.

  Chat or AI generation fails         Verify `GEMINI_API_KEY` is set in
                                      the backend environment, the key is
                                      active, the model is available, and
                                      quota/rate limits have not been
                                      exceeded.

  Assessment sample questions appear  Check whether development-only
                                      `ENABLE_MOCK_QUIZ=true` is enabled;
                                      sample questions should be labeled.

  Resume upload fails                 Check file type, text-based
                                      PDF/DOCX support, upload size
                                      limit, permissions, and
                                      `UPLOAD_DIR`.

  Resume file disappears after        Verify that the Render persistent
  deployment                          disk is attached and
                                      `UPLOAD_DIR=/var/data/uploads`.

  Old records are missing on Render   Check which database the old app
                                      used. Local MongoDB and Atlas are
                                      separate; migrate and verify the
                                      correct collections and document
                                      counts.

  Job portal is empty                 Provider calls are disabled by
                                      default. Review Adzuna terms, then
                                      check `ADZUNA_ENABLED`,
                                      credentials, country, and provider
                                      configuration. No fake listings are
                                      intended as a fallback.

  Tests fail                          Read the first traceback/error,
                                      verify dependencies and environment
                                      configuration, and run the relevant
                                      test independently.
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 17. Limitations and future improvements

These items should be described as future work unless they have since
been implemented and tested.

-   Add a verified password-recovery workflow for legacy accounts.
-   Add explicit API documentation for every onboarding, chat,
    assessment, and resume endpoint.
-   Add more automated integration tests for authentication boundaries
    and cross-user data access.
-   Add generated PDF/DOCX resume export and download.
-   Review and, if permitted, enable Adzuna integration with real
    credentials.
-   Add an external scheduler only if periodic job refresh is required;
    the current fallback refreshes on an authenticated request.
-   Validate skill-estimation rules against an appropriate evaluation
    process before presenting them as reliable proficiency measurements.
-   Add monitoring and operational alerts for database availability,
    AI-provider failures, and quota limits.
-   Review upload validation, retention, and access controls as part of
    a production security audit.

------------------------------------------------------------------------

## 18. Placement and interview preparation

Use this section to explain the project clearly in interviews. Tie each
answer to code you can show in the repository.

### 18.1 One-minute project explanation

> "Aishu's AI Assistant is a full-stack student learning and
> career-support application. I used HTML, CSS, and JavaScript for the
> frontend, FastAPI for the backend, and MongoDB for persistent storage.
> Students can create an account, sign in with a secure session cookie,
> ask profile-aware questions through Google Gemini, take assessments,
> and review saved progress through dashboards. The platform also
> manages learning tasks, resume versions, and an optional Adzuna
> job-search integration. I focused on keeping AI and database
> credentials on the backend, separating profile information from
> assessment evidence, and preserving student progress across sessions."

Only claim work you personally implemented, tested, and can explain. If
asked about a feature that is only partly implemented, state its current
status honestly.

### 18.2 Project discussion questions

**Q1. Why did you use FastAPI?**

FastAPI provides Python-based HTTP routing, request validation, and
interactive API documentation. It also allows the same application to
serve frontend files and API routes.

**Q2. Why MongoDB?**

MongoDB stores application data as documents and is suitable for
evolving profile, attempt, learning-plan, resume-version, and cache
records. The exact data model and indexes should be explained from the
actual code.

**Q3. How does authentication work?**

The backend verifies credentials, creates a session, and sends an opaque
session cookie marked `HttpOnly` and `SameSite=Lax`. The database stores
a hash of the session token. Protected routes validate the session
rather than trusting a supplied profile ID.

**Q4. Why hash passwords?**

A password hash is designed to avoid storing the original password. This
project uses salted `scrypt` hashes. Password hashing is different from
encryption: hashing is not intended to be reversed to recover the
password.

**Q5. What is the difference between authentication and authorization?**

Authentication verifies identity. Authorization determines whether that
identity is allowed to perform an operation or access a resource.

**Q6. How does Gemini integration work?**

The browser sends the chat request to FastAPI. The backend manages
context and request limits and calls Gemini using a server-side API key.
The key should never be placed in frontend JavaScript.

**Q7. Does every feature use AI?**

No. Gemini supports AI-powered chat and documented generation features.
Normal scoring, pass/fail decisions, dashboard calculations,
learning-task status, and job caching use backend application logic.

**Q8. How is an assessment result saved?**

The backend evaluates the submitted answers, calculates a result, and
stores the attempt. The dashboard and history views read saved records
so the student can review progress later.

**Q9. Are skills in a resume automatically verified?**

No. The project distinguishes skills mentioned in a profile or resume
from assessment-based evidence. The skill estimates use configurable
product rules and should not be described as scientifically validated
measurements.

**Q10. How are resume versions preserved?**

Uploaded files are stored privately rather than overwritten. Structured
resume changes and history are recorded in `resume_versions`; eligible
additions require the relevant learning/assessment criteria and student
confirmation.

**Q11. How do you deploy it?**

The documented deployment uses a Render Web Service to serve FastAPI and
the static frontend from one origin. MongoDB Atlas stores database
records, while a Render persistent disk stores uploaded resume files.

**Q12. What security decisions did you make?**

The documented design uses salted password hashes, hashed session
tokens, `HttpOnly` cookies, session expiry/revocation, backend-only
provider credentials, and authorization checks. Production deployment
also needs restricted database network access and careful secret
management.

**Q13. What happens if Gemini is unavailable?**

AI-powered requests may fail because of credentials, quota, model
availability, or network issues. Normal backend scoring and dashboard
calculations do not depend on Gemini. Explain the actual error handling
in the code during an interview.

**Q14. What is the difference between MongoDB and the upload
directory?**

MongoDB stores structured records and metadata. The upload directory
stores the actual resume file bytes. Deployments must preserve both if
existing resumes need to remain accessible.

**Q15. What would you improve next?**

Reasonable next steps include verified password recovery, more
integration tests, resume export, monitoring, a reviewed production
job-provider integration, and stronger validation of skill-estimation
rules.

### 18.3 Topics to revise before interviews

-   **Python:** functions, classes, exceptions, virtual environments,
    modules, async concepts if used.
-   **FastAPI / REST:** HTTP methods, status codes, request/response
    validation, routing, dependency handling, API documentation.
-   **JavaScript:** promises, `async`/`await`, `fetch`, JSON, form
    validation, DOM updates, error handling.
-   **MongoDB:** databases vs collections vs documents, CRUD, filters,
    indexes, connection strings, Atlas network access.
-   **Authentication:** password hashing, cookies, sessions, `HttpOnly`,
    `SameSite`, authentication vs authorization.
-   **AI integration:** API keys, prompts/context, token limits,
    timeouts, retries, quotas, rate limiting.
-   **Testing:** unit tests vs integration tests, test discovery, syntax
    checks, regression testing.
-   **Deployment:** environment variables, Git/GitHub, Render
    build/start commands, health checks, persistent disks, database
    migration.
-   **Security:** secret management, least privilege, input validation,
    cross-user data isolation, secure HTTPS cookies.

### 18.4 Be ready to demonstrate

-   Register, log in, and log out.
-   Refresh the browser and explain how the session is restored.
-   Ask the assistant a question and identify the backend-to-Gemini
    flow.
-   Submit an assessment and find its saved attempt.
-   Explain the difference between resume-listed skills and assessed
    evidence.
-   Show the relevant MongoDB collections without exposing private
    records or credentials.
-   Explain how the frontend is served by FastAPI and how the app is
    configured for Render.

------------------------------------------------------------------------

## 19. Glossary

  -----------------------------------------------------------------------
  Term                                Meaning
  ----------------------------------- -----------------------------------
  API                                 A defined interface that lets
                                      software components communicate

  REST                                A common style for designing HTTP
                                      APIs around resources and
                                      operations

  FastAPI                             Python framework used to build the
                                      backend HTTP application

  MongoDB collection                  A group of MongoDB documents

  Document                            A MongoDB record represented as a
                                      BSON/JSON-like structure

  Authentication                      Verifying a user's identity

  Authorization                       Checking access permissions

  Session cookie                      Browser-managed value used to
                                      associate requests with a login
                                      session

  `HttpOnly`                          Cookie setting that prevents
                                      ordinary frontend JavaScript from
                                      reading the cookie

  `SameSite=Lax`                      Cookie policy that limits some
                                      cross-site cookie sending

  Password hash                       One-way derived value used to
                                      verify a password without storing
                                      its original text

  API key                             Secret credential used to
                                      authenticate requests to an
                                      external service

  Rate limiting                       Restricting request frequency over
                                      a defined period

  Cache                               Stored results reused to reduce
                                      repeated work or provider requests

  Persistent disk                     Storage intended to survive
                                      application restarts/deploys,
                                      subject to the hosting
                                      configuration

  Environment variable                Configuration value supplied
                                      outside application source code

  Health check                        Endpoint used to confirm that an
                                      application is responding and,
                                      where implemented, connected to
                                      required services
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## Project structure

The documented paths include:

``` text
Vaishuscopilt/
├── backend/
│   ├── main.py
│   ├── requirements.txt
│   ├── .env                 # local secrets; do not commit
│   ├── .env.example        # placeholders only
│   └── uploads/            # private resume files; do not commit
├── frontend/
│   ├── dashboard.html
│   ├── dashboard.js
│   ├── skills.html
│   ├── performance.html
│   ├── jobs.html
│   ├── resume.html
│   ├── learning.html
│   └── profile.html
├── render.yaml
├── .gitignore
└── README.md
```

This is a representative structure based on the paths referenced in the
project documentation. Other frontend pages, backend modules, and tests
may also exist.

------------------------------------------------------------------------

## Final checklist

-   [ ] The application starts locally and `/health` responds.
-   [ ] `.env` and all secrets are excluded from Git.
-   [ ] Login, logout, and session restoration work.
-   [ ] A test assessment is saved and appears in history.
-   [ ] Dashboard and learning data persist after re-login.
-   [ ] Cross-user access has been checked with separate test accounts.
-   [ ] Resume uploads are stored privately and the upload path is
    correct.
-   [ ] Render environment variables are configured without exposing
    secrets.
-   [ ] Atlas network access is restricted as much as the deployment
    allows.
-   [ ] The deployed health check succeeds.
-   [ ] Every feature claimed in the README has been personally
    verified.

------------------------------------------------------------------------

**Built with:** HTML, CSS, JavaScript, Python, FastAPI, MongoDB, Google
Gemini, and Render.
