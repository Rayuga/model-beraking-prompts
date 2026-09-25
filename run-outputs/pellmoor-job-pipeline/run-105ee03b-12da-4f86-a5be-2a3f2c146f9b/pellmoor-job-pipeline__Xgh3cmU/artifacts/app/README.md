# Pellmoor Hiring Workspace

A comprehensive hiring and recruitment management system enforcing strict stage progression rules and comprehensive audit trails.

## Quick Start

```bash
npm run build
node /app/backend/server.js
```

The server will:
1. Initialize SQLite database at `/app/pellmoor.db`
2. Create all necessary tables
3. Load seed data from `/recruitment/records/pellmoor_seed_data.json`
4. Listen on `0.0.0.0:3000`

Visit http://localhost:3000 in your browser and sign in with demo credentials below.

## Demo Accounts

All use password: `password123`

| Email | Name | Role |
|-------|------|------|
| hiring@pellmoor.test | Ruth Aldane | Hiring Manager |
| panel1@pellmoor.test | Otis Barre | Panel Member |
| panel2@pellmoor.test | Wren Foss | Panel Member |
| coord@pellmoor.test | Cal Meriden | Coordinator |

## Architecture

### Backend
- **Express.js** - REST API server
- **SQLite** - Persistent data storage
- **Session-based Auth** - Bearer token authentication

### Frontend
- **TypeScript** - Type-safe application code
- **esbuild** - Fast bundling
- **Responsive CSS** - Mobile-friendly with light/dark theme

## Hiring Pipeline

### Stages (Sequential)
1. **Applied** - Initial application
2. **Screening** - Initial review
3. **Interview** - Detailed assessment
4. **Offer** - Formal offer made
5. **Hired** - Candidate accepted

### Terminal States
- **Rejected** - Application declined
- **Withdrawn** - Candidate withdrew

### Stage Rules
- No stage skipping allowed
- Maximum one stage backward movement
- Panel and scores required before offer
- Capacity limits enforced
- Assessment versions increment on panel changes

## Key Features

### Stage Progression
- Only hiring managers move candidates between stages
- Enforced linear progression or single stage backward
- Comprehensive validation per hiring rules
- All changes tracked in activity trail

### Panel Management
- Coordinators assign 2+ panel members
- At least one non-hiring manager required
- Panel members score 1-5 at interview stage
- Assessment version increments when panel changes
- Historical scores retained with version tracking

### Capacity Management
- Vacancy opening counts enforced
- Filled = hired candidates
- Reserved = candidates in offer stage
- Available = remaining openings
- Prevents overbooking

### Batch Offers
- Hiring managers select multiple candidates at once
- Review and confirm together
- All-or-nothing atomic operation
- Durable operation receipts with retry contract

### Activity Audit Trail
- Append-only record of all changes
- Includes actor, timestamp, action type
- Tracks stage changes, panel modifications, scores, notes
- Assessment version changes recorded
- Batch operations linked by ID

### Conflict Resolution
- Revision-aware updates
- Stale updates return 409 with current state
- Concurrent writes safely arbitrated
- User can refresh and retry

## API Endpoints

See `APP_MANIFEST.md` for complete API documentation.

### Authentication
- `POST /auth/login` - Create session
- `POST /auth/logout` - Revoke session
- `GET /auth/session` - Validate session

### Vacancies
- `GET /api/vacancies` - List all vacancies
- `GET /api/vacancies/:roleCode` - Get vacancy details
- `POST /api/vacancies/:roleCode/candidates` - Add candidate
- `POST /api/vacancies/:roleCode/candidates/:candidateId/move` - Move candidate

### Panels & Scores
- `GET /api/candidates/:candidateId/panel` - Get panel info
- `POST /api/candidates/:candidateId/panel/add` - Add panel member
- `POST /api/candidates/:candidateId/panel/remove` - Remove panel member
- `POST /api/candidates/:candidateId/score` - Record score

### Notes
- `POST /api/candidates/:candidateId/note` - Add note
- `GET /api/candidates/:candidateId/notes` - Get notes

### Batch Offers
- `POST /api/vacancies/:roleCode/batch-offer/preview` - Preview batch
- `POST /api/vacancies/:roleCode/batch-offer/commit` - Commit batch

## Database Schema

### Core Tables
- **users** - User accounts with roles
- **roles** - Job vacancies with opening counts
- **candidates** - Applicants with current stage and assessment version
- **stage_history** - Complete pipeline history for each candidate

### Panel & Scoring
- **panels** - Interview panels per assessment version
- **panel_members** - Individual panel assignments
- **scores** - Scores per assessment version per panel member

### Notes & Activity
- **notes** - Candidate feedback (append-only)
- **activity_trail** - Complete audit of all changes
- **vacancy_revisions** - Tracks each vacancy's revision number

### Sessions & Receipts
- **sessions** - Active authentication sessions
- **operation_receipts** - Durable operation history for retries

## Permission Model

| Role | Can |
|------|-----|
| Hiring Manager | Move candidates, batch offers, add notes |
| Coordinator | Add candidates, manage panels, add notes |
| Panel Member | Record scores, add notes |

## Compliance

✓ No stage skipping - validated server-side
✓ Assessment versioning - incremented on panel/interview changes
✓ Capacity enforcement - prevents overbooking
✓ Atomic batches - all-or-nothing with operation receipts
✓ Conflict resolution - 409 responses with current state
✓ Activity trail - complete append-only audit
✓ Session security - bearer tokens, server-validated
✓ Permission enforcement - role-based access control

## Development

### Build
```bash
npm run build
```

Bundles TypeScript frontend to `/app/public/index.js`

### Start Server
```bash
node /app/backend/server.js
```

The server will automatically:
- Create database and schema
- Load seed data
- Start listening on port 3000

### Configuration

Set `DB_PATH` environment variable to use non-default database location:
```bash
DB_PATH=/custom/path/db.db node /app/backend/server.js
```

## Hiring Rules

Complete hiring rules documented in `/instructions/hiring-rules.md` which:
- Define stage progression rules
- Specify panel requirements
- Detail capacity management
- Explain assessment versioning
- Document batch offer atomicity
- Define concurrent update handling

All rules are enforced by the server.

## Troubleshooting

### Database locked error
- SQLite may be in use by multiple processes
- Ensure only one server instance is running
- Check for stale database lock files

### Stale revision errors (409)
- Another user has modified the vacancy since you loaded it
- Refresh the vacancy to get current revision
- Retry your operation with the new revision

### Missing panels or scores
- Check that candidate is at interview stage (required for scoring)
- Ensure all panel members have been added
- Verify all panel members have submitted scores

## License

Copyright Pellmoor - All rights reserved
