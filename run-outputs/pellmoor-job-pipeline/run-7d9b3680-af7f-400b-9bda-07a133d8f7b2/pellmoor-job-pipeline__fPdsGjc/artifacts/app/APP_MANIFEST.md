# Pellmoor Hiring Workspace

```bash
npm run build
node /app/backend/server.js
```

SQLite path: /app/pellmoor.db

## Routes

### Authentication
- `POST /api/login`
- `POST /api/logout`
- `GET /api/bootstrap`

### Vacancy reads
- `GET /api/vacancies`
- `GET /api/vacancies/:code`
- `POST /api/vacancies/:code/batch-preview`
- `POST /api/vacancies/:code/batch-offers`

### Candidate reads and writes
- `GET /api/candidates/:id`
- `POST /api/vacancies/:code/candidates`
- `POST /api/candidates/:id/stage`
- `POST /api/candidates/:id/panel`
- `POST /api/candidates/:id/scores`
- `POST /api/candidates/:id/notes`
