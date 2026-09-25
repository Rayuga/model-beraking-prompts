# Pellmoor Hiring Workspace - Application Manifest

## Build and Startup

```bash
npm run build
```

```bash
node /app/backend/server.js
```

SQLite path: /app/pellmoor.db

## Server

- **Framework**: Express.js
- **Port**: 0.0.0.0:3000
- **Startup**: `node /app/backend/server.js`
- **Build**: `npm run build` (bundles browser TypeScript with esbuild)

## Database

- **Location**: `/app/pellmoor.db` (or `DB_PATH` environment variable if provided)
- **Type**: SQLite with foreign key constraints enabled
- **Initialization**: Automatic on server startup, seeded from `/recruitment/records/pellmoor_seed_data.json`

## Authentication

### Accounts
- **hiring@pellmoor.test** (Ruth Aldane) - Hiring Manager - password: password123
- **panel1@pellmoor.test** (Otis Barre) - Panel Member - password: password123
- **panel2@pellmoor.test** (Wren Foss) - Panel Member - password: password123
- **coord@pellmoor.test** (Cal Meriden) - Coordinator - password: password123

### Session Management
- Bearer token authentication
- Sessions stored in SQLite
- 24-hour session lifetime
- Revoked on logout

## API Routes

### Authentication
- **POST** `/auth/login` - Login with email and password
- **POST** `/auth/logout` - Logout current session
- **GET** `/auth/session` - Validate and retrieve current session

### Vacancies
- **GET** `/api/vacancies` - Get all vacancies with current pipeline state
- **GET** `/api/vacancies/:roleCode` - Get specific vacancy with all candidates
- **POST** `/api/vacancies/:roleCode/candidates` - Create new candidate (coordinator only)
- **POST** `/api/vacancies/:roleCode/candidates/:candidateId/move` - Move candidate to next stage (hiring manager only)

### Panels and Scores
- **GET** `/api/candidates/:candidateId/panel` - Get panel and scores for candidate
- **POST** `/api/candidates/:candidateId/panel/add` - Add panel member (coordinator only)
- **POST** `/api/candidates/:candidateId/panel/remove` - Remove panel member (coordinator only)
- **POST** `/api/candidates/:candidateId/score` - Record score (panel member only)

### Notes
- **POST** `/api/candidates/:candidateId/note` - Add note to candidate (all authenticated users)
- **GET** `/api/candidates/:candidateId/notes` - Get all notes for candidate

### Batch Offers
- **POST** `/api/vacancies/:roleCode/batch-offer/preview` - Preview batch offer (hiring manager only)
- **POST** `/api/vacancies/:roleCode/batch-offer/commit` - Commit batch offer (hiring manager only)

## Features

### Candidate Pipeline
- **Stages**: applied → screening → interview → offer → hired
- **Terminal**: rejected, withdrawn
- **Rules**: Candidates cannot skip stages (max 1-stage backward movement)
- **Validation**: Server enforces all stage transitions per hiring rules

### Assessment Management
- **Versioning**: Incremented when panel changes or interview stage is re-entered
- **Scoring**: 1-5 scale, required for interview stage before offer
- **History**: Historical scores and panel assignments retained with version tracking

### Capacity Management
- **Tracking**: Filled (hired), Reserved (offer), Available
- **Enforcement**: No overbooks; moves to offer blocked if no available capacity
- **Atomicity**: Batch operations respect capacity constraints

### Batch Offers
- **Selection**: Multiple candidates reviewed together
- **Validation**: All selected must be at interview with complete assessments
- **Atomicity**: All or nothing commit; failure leaves all records unchanged
- **Retry Contract**: Durable operation identity, retries return same result

### Activity Trail
- **Append-only**: All actions recorded with actor, timestamp, action type
- **Completeness**: Stage changes, panel additions/removals, scores, notes
- **Versioning**: Includes assessment version changes and reasons
- **Batch Tracking**: Batch offers linked by ID with position and total

### Funnel Analysis
- **Derived**: Calculated from candidate stage history, not stored
- **Accuracy**: Reached, remaining, and lost counts per stage
- **Terminal Handling**: Loss attributed to last pipeline stage before rejection/withdrawal

## Data Models

### Users
- email (TEXT, PRIMARY KEY)
- name (TEXT)
- role (TEXT) - "hiring manager", "coordinator", "panel"
- password_hash (TEXT)

### Sessions
- token (TEXT, PRIMARY KEY)
- email (TEXT, FOREIGN KEY)
- created_at (TEXT)
- expires_at (TEXT)

### Roles (Vacancies)
- code (TEXT, PRIMARY KEY) - e.g., "ROLE-014"
- title (TEXT)
- team (TEXT)
- openings (INTEGER)

### Candidates
- id (TEXT, PRIMARY KEY) - e.g., "CAND-101"
- role_code (TEXT, FOREIGN KEY)
- name (TEXT)
- current_stage (TEXT)
- assessment_version (INTEGER)
- created_at (TEXT)
- updated_at (TEXT)

### Stage History
- id (INTEGER, PRIMARY KEY)
- candidate_id (TEXT, FOREIGN KEY)
- stage (TEXT)
- timestamp (TEXT)

### Panels
- id (INTEGER, PRIMARY KEY)
- candidate_id (TEXT, FOREIGN KEY)
- assessment_version (INTEGER)
- created_at (TEXT)

### Panel Members
- id (INTEGER, PRIMARY KEY)
- panel_id (INTEGER, FOREIGN KEY)
- email (TEXT, FOREIGN KEY)
- added_at (TEXT)

### Scores
- id (INTEGER, PRIMARY KEY)
- candidate_id (TEXT, FOREIGN KEY)
- assessment_version (INTEGER)
- panel_member_email (TEXT, FOREIGN KEY)
- score (INTEGER) - 1-5
- recorded_at (TEXT)
- UNIQUE(candidate_id, assessment_version, panel_member_email)

### Notes
- id (INTEGER, PRIMARY KEY)
- candidate_id (TEXT, FOREIGN KEY)
- author_email (TEXT, FOREIGN KEY)
- content (TEXT)
- created_at (TEXT)

### Vacancy Revisions
- id (INTEGER, PRIMARY KEY)
- role_code (TEXT, FOREIGN KEY)
- revision_number (INTEGER)
- changed_by (TEXT, FOREIGN KEY)
- change_reason (TEXT)
- changed_at (TEXT)
- UNIQUE(role_code, revision_number)

### Activity Trail
- id (INTEGER, PRIMARY KEY)
- role_code (TEXT, FOREIGN KEY)
- candidate_id (TEXT, FOREIGN KEY)
- action_type (TEXT) - stage_change, panel_member_added, panel_member_removed, score_recorded, note_added, batch_offer, candidate_added
- actor_email (TEXT, FOREIGN KEY)
- action_data (TEXT, JSON)
- batch_id (TEXT) - For batch offer tracking
- batch_position (INTEGER)
- batch_total (INTEGER)
- assessment_version_at_action (INTEGER)
- assessment_version_changed (BOOLEAN)
- created_at (TEXT)

### Operation Receipts
- operation_id (TEXT)
- actor_email (TEXT)
- role_code (TEXT, FOREIGN KEY)
- operation_type (TEXT) - batch_offer, etc.
- status (TEXT) - success, rejected
- request_data (TEXT, JSON)
- response_data (TEXT, JSON)
- created_at (TEXT)
- PRIMARY KEY(operation_id, actor_email)

## Frontend

- **Framework**: TypeScript
- **Bundler**: esbuild
- **Entry**: `/app/frontend/index.ts`
- **Output**: `/app/public/index.js`
- **HTML**: `/app/public/index.html`
- **Styles**: `/app/public/styles.css`

### Features
- Responsive design (mobile-friendly, no horizontal overflow)
- Light/dark theme support
- Vacancy list with pipeline overview
- Candidate details drawer with timeline, panel, notes
- D3-based funnel visualization
- Batch offer planning and confirmation
- Real-time validation feedback
- Conflict detection and refresh prompts

## Compliance with Hiring Rules

✓ No stage skipping - server validates all transitions
✓ Back one stage only - enforced on server
✓ Panel requirements - minimum 2 members, non-hiring-manager required
✓ Assessment versioning - incremented on panel/interview changes
✓ Score freshness - current version required for offers
✓ Capacity enforcement - no overbooks, releases on stage changes
✓ Atomic batches - all-or-nothing with durable receipts
✓ Conflict handling - 409 responses for stale revisions
✓ Activity trail - append-only with full attribution
✓ Session security - bearer tokens, server-validated
