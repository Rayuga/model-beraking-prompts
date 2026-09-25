# Coursemark runtime

```bash
node /app/server.js
```

SQLite path: /app/coursemark.db

Outcome workflows: GET /api/outcomes; PUT /api/outcome-weights;
PUT /api/outcome-exceptions; PUT /api/grading-worksheet/:id;
POST /api/release-plans (read-only preview of course data);
POST /api/release-plans/commit. All require a bearer session. All course-data
writes use expected_revision and operation_id; previews use expected_revision
and attempt_ids and return an actor/revision-bound plan_id. Outcomes and preview
bindings persist in the same SQLite database.

DB_PATH may override the database location. All protected requests use the
server-issued Bearer token. Writes carry expected_revision and operation_id.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | / | Browser workspace |
| GET | /api/health | Startup readiness |
| POST | /api/auth/login | Create session |
| POST | /api/auth/logout | Revoke all account sessions |
| GET | /api/me | Identity, fixed reference moment, revision |
| GET | /api/courses | Enrolled courses |
| GET | /api/assessments | Role-filtered assessments |
| GET | /api/assessments/:id/items | Role-filtered questions |
| POST | /api/assessments | Create draft |
| POST | /api/assessments/:id/items | Add question |
| POST | /api/assessments/:id/publish | Publish draft |
| POST | /api/assessments/:id/start | Start attempt |
| GET | /api/attempts | Private attempts and grading records |
| PATCH | /api/attempts/:id/answers | Save answers |
| POST | /api/attempts/:id/submit | Submit attempt |
| PUT | /api/attempts/:id/grades/:criterionId | Save rubric score/feedback |
| POST | /api/attempts/:id/release | Release completed grading |
| GET | /api/audit | Role-filtered event history |
