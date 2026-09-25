# Coursemark Application Manifest

## Start Command

```bash
node /app/server.js
```

Server runs on `0.0.0.0:3000`

## Database

SQLite path: /app/coursemark.db

## Authentication

- **POST /api/auth/sign-in** - Sign in with email and password. Returns bearer token and user.
- **POST /api/auth/sign-out** - Sign out and revoke all sessions for the account.
- Bearer tokens stored in SQLite `sessions` table.
- All protected endpoints require `Authorization: Bearer <token>` header.

## Course Access

- **GET /api/courses** - List courses user is enrolled in or instructing.
- **GET /api/courses/:courseId** - Get single course with current revision.

## Assessment Authoring (Instructor Only)

- **GET /api/assessments/:courseId** - List course assessments (students see published only).
- **GET /api/assessments/:courseId/:assessmentId** - Get assessment details with items.
- **POST /api/assessments/:courseId/create-draft** - Create draft assessment with title, opens_at, due_at, duration_minutes, max_attempts.
- **POST /api/assessments/:courseId/:assessmentId/add-item** - Add question (multiple_choice or written) with validation.
- **POST /api/assessments/:courseId/:assessmentId/publish** - Publish assessment (terminal, requires questions).

## Student Attempts

- **POST /api/attempts/:courseId/start** - Start timed attempt with accommodation application.
- **POST /api/attempts/:attemptId/save-answer** - Save student answer (idempotent by operation ID).
- **POST /api/attempts/:attemptId/submit** - Submit attempt, calculate objective score, record audit event.
- **GET /api/attempts/:attemptId** - Get attempt details (students see only their own in-progress answers).

## Grading & Release

- **POST /api/attempts/:attemptId/grade** - Grade single rubric criterion (instructor/assigned TA).
- **POST /api/attempts/:attemptId/grade-worksheet** - Grade multiple criteria atomically.
- **POST /api/attempts/:attemptId/release** - Release grades to student (instructor only, idempotent).
- **GET /api/courses/:courseId/outcomes** - Get outcome ledger with weighted calculations (instructor only).

## Outcome Management

- **POST /api/courses/:courseId/outcome-weights** - Set assessment weights (must total 100%, published only).
- **POST /api/courses/:courseId/outcome-exception** - Excuse or restore student work.

## Batch Release

- **POST /api/courses/:courseId/release-preview** - Create preview handle for selected attempts.
- **POST /api/courses/:courseId/release-commit** - Atomically release all selected attempts.

## Audit

- **GET /api/audit/:courseId** - Get filtered audit trail (role-specific visibility).

## Health Check

- **GET /api/health** - No authentication required. Returns JSON health object.

## Concurrency & Idempotency

- Each course has an integer `revision` tracking data writes.
- Stale-write requests return 409 with current revision.
- All write operations require `operationId` (unpredictable string).
- Duplicate operations return cached result without side effects.
- Operation receipts stored with user, method, path, input hash in SQLite.

## Privacy Enforcement

- Unreleased rubric scores and feedback never appear in responses.
- Students see only their own attempts and released data.
- Teaching assistants see only assigned submissions.
- Answer keys hidden from students.

## Data Persistence

- SQLite with WAL mode for concurrent access.
- Foreign key constraints enforced.
- Seed data imported on first database creation.
- All sessions, audit, and operation receipts survive restart.
