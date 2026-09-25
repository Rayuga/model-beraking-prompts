# Pellmoor Hiring Workspace

## Server Startup
```bash
node /app/backend/server.js
```

SQLite path: /app/pellmoor.db

## API Manifest

### Authentication
- `POST /api/auth/login` - Authenticate with email and password, creating a persistent bearer session.
- `POST /api/auth/logout` - Revoke current bearer session.
- `GET /api/auth/me` - Get authenticated user profile and permissions.
- `GET /api/auth/people` - Get list of users / panel members.

### Vacancies & Pipeline Funnel
- `GET /api/vacancies` - List all vacancies with capacity figures (openings, reserved, filled, available) and candidate counts.
- `GET /api/vacancies/:code` - Retrieve complete vacancy details including derived D3 funnel data, candidates, and activity trail.

### Candidates
- `POST /api/candidates` - Create a new candidate for a vacancy (Coordinator only). Initializes candidate at stage `applied` with `assessment_version` 1.
- `GET /api/candidates/:id` - Get candidate details, history visits, panel assignments, current scores, historical scores, and offer readiness.
- `POST /api/candidates/:id/stage` - Transition candidate stage (Hiring Manager only). Enforces sequential forward moves (+1), backsteps (-1), terminal transitions, offer gate prerequisites, and assessment version advancement upon entering interview.
- `POST /api/candidates/:id/panel` - Add or remove interview panel members (Coordinator only). Advances candidate assessment version and preserves assessment freshness.
- `POST /api/candidates/:id/scores` - Record whole-number score (1 to 5) for candidate in interview stage (Assigned panel members only).
- `POST /api/candidates/:id/notes` - Append unmodifiable note to candidate record (All authenticated roles).

### Atomic Batch Offers
- `POST /api/vacancies/:code/batch-offers/preview` - Point-in-time read-only preview of selected applicants, individual eligibility, and projected capacity.
- `POST /api/vacancies/:code/batch-offers` - Atomically transition one or more interview candidates to offer stage (Hiring Manager only). Verifies full batch eligibility, available capacity, and advances vacancy revision once with linked batch activity events.
