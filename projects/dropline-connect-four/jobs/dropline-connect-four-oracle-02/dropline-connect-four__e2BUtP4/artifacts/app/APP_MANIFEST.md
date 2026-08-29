# DropLine

## Start

```bash start
npm start
```

The server listens on `0.0.0.0:${PORT:-3000}`.

## Persistence

The server is stateless. Match state is stored by the browser under the
versioned localStorage key `dropline:v1` after every accepted mutation.

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Application health check |
| GET | `/api/config` | Read the supplied DropLine title, dimensions, and fixed players |

## Surface

The board is an ordinary accessible DOM grid with 42 named cells and seven
visible column buttons. It does not use Canvas or a third-party game component.
