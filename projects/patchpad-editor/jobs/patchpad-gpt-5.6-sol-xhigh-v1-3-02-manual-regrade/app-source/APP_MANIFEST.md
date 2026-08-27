# PatchPad application manifest

```bash start
npm start
```

- **Database:** `data/patchpad.db` (override with `DATABASE_PATH`)
- **Main UI:** `GET /`
- **Documents:** `GET /api/documents`, `GET /api/documents/:id`
- **Save:** `PUT /api/documents/:id`
- **Revision history:** `GET /api/documents/:id/revisions`
- **Revision preview:** `GET /api/documents/:id/revisions/:revision`
