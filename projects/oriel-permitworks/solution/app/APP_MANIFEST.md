# Oriel Permitworks

Run the delivered municipal permit desk with:

```bash start
npm start
```

The service listens on `0.0.0.0:3000`, serves the Tailwind operations UI and
authenticated JSON interface from one Express process, and persists records to
`oriel.db` unless `SQLITE_PATH` is supplied. The browser attaches its
server-issued bearer session to protected operations.
