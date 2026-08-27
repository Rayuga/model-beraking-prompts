# GridForge application manifest

```bash start
npm start
```

- **Database:** `/app/gridforge.sqlite`
- **Main UI:** `GET /`
- **Workbook:** `GET /api/workbooks/:id`
- **Sessions:** `POST /api/sessions`, `PATCH|DELETE /api/sessions/:id`
- **Save:** `POST /api/workbooks/:id/save`
- **Revisions:** `GET /api/workbooks/:id/revisions`, `GET /api/workbooks/:id/revisions/:number`
- **Live events:** `GET /api/events?sessionId=...`
