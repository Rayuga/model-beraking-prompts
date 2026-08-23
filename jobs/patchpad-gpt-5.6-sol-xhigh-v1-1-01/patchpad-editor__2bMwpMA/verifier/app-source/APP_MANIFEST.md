# PatchPad application manifest

```bash start
npm start
```

- **Database:** `./data/patchpad.sqlite` (override with `DATABASE_PATH`)
- **Main API routes:**
  - `GET /api/documents`
  - `GET /api/documents/:id`
  - `PUT /api/documents/:id`
  - `GET /api/documents/:id/revisions`
  - `GET /api/documents/:id/revisions/:revision`
  - `POST /api/documents/:id/restore/:revision`
