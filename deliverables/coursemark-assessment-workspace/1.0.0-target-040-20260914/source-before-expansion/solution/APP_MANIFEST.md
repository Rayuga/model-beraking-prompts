# Coursemark runtime

```bash
node /app/server.js
```

SQLite path: /app/coursemark.db

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
