# Coursemark app manifest

```bash
node /app/server.js
```

SQLite path: /app/coursemark.db

## Authentication
- `POST /api/auth/sign-in`
- `GET /api/auth/me`
- `POST /api/auth/sign-out`

## Course and workspace reads
- `GET /api/health`
- `GET /api/workspace`
- `GET /api/assessments`
- `GET /api/assessments/:assessmentId`
- `GET /api/attempts/:attemptId`
- `GET /api/gradebook`
- `GET /api/audit`

## Assessment authoring
- `POST /api/assessments`
- `POST /api/assessments/:assessmentId/items`
- `POST /api/assessments/:assessmentId/publish`

## Attempt start, answer save, and submission
- `POST /api/assessments/:assessmentId/start`
- `PUT /api/attempts/:attemptId/answers/:itemId`
- `POST /api/attempts/:attemptId/submit`

## Grading and release
- `POST /api/attempts/:attemptId/grades`
- `POST /api/attempts/:attemptId/release`
- `POST /api/release-previews`
- `POST /api/release-previews/:previewId/commit`

## Outcome ledger
- `POST /api/outcomes/policy`
- `POST /api/outcomes/exceptions`
