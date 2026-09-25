# Coursemark Application Manifest

## Start Command

```bash
node /app/server.js
```

SQLite path: /app/coursemark.db

## Endpoints and Routes

### Health Check
- `GET /api/health` - Public health check and service status

### Authentication & Sessions
- `POST /api/auth/login` - User sign-in, issues SQLite-persisted bearer token
- `POST /api/auth/logout` - User sign-out, revokes all active session tokens for the account
- `GET /api/auth/me` - Read authenticated user profile and course revision state

### Courses & Overview
- `GET /api/courses` - Read enrolled course BIO-214 overview, roster, and accommodations

### Assessment Authoring & Availability
- `GET /api/assessments` - Read course assessments (role-filtered: staff sees drafts & published; students see published only)
- `GET /api/assessments/:id` - Read assessment details and questions (staff sees answer keys; students never receive answer keys)
- `POST /api/assessments` - Create draft assessment (instructor only)
- `POST /api/assessments/:id/items` - Add multiple-choice or written question with rubric criteria to draft (instructor only)
- `POST /api/assessments/:id/publish` - Publish draft assessment with terminal status and 0% initial weight (instructor only)

### Timed Attempts & Answers
- `GET /api/attempts` - Read attempts (role-isolated: instructor sees all, TA sees assigned, student sees own with unreleased scores hidden)
- `GET /api/attempts/:id` - Read attempt details, items, student answers, and grading/feedback
- `POST /api/attempts/start` - Start timed assessment attempt applying student accommodations (student only)
- `POST /api/attempts/:id/answers` - Save in-progress answers before expiry (student only)
- `POST /api/attempts/:id/submit` - Terminal submission of attempt with auto-objective scoring (student only)

### Grading & Rubrics
- `POST /api/grading/rubric` - Save single rubric criterion score and feedback (instructor or assigned TA)
- `POST /api/grading/worksheet` - Atomic multi-row rubric worksheet grading with single revision increment (instructor or assigned TA)

### Feedback Release
- `POST /api/release/single` - Release scores and feedback for single graded attempt (instructor only)
- `POST /api/release/preview` - Preview recipient details, assessment titles, and awarded totals for reviewed batch release (instructor only)
- `POST /api/release/commit` - Atomic reviewed batch release commit bound to revision (instructor only)

### Outcome Ledger, Policy & Exceptions
- `GET /api/outcomes` - Read weighted outcome ledger (instructor sees all students; students see own outcome row; TA forbidden)
- `POST /api/policy` - Update assessment outcome percentage weighting policy (instructor only)
- `POST /api/exceptions` - Excuse or restore student assessment with required reason (instructor only)

### Durable Audit Logging
- `GET /api/audit` - Read durable newest-first audit events (role-filtered without score leakage)
