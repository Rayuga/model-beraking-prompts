# Environment Variables

The plant ledger is SQLite. A spreadsheet is not the books.

## The card desk

The plant's card desk takes the card on its own origin; this app never sees
card details. It is reached the same way as the other desks, with
`VENDOR_BASE_URL` and `VENDOR_TOKEN` — see `CREDENTIALS-desks.md`. Do not
put desk tokens in source, seed JSON, or anything the browser is served.
The window takes the test card `4242 4242 4242 4242`.

## SQLite books

The till keeps pennies in SQLite. Artifact JSON is whole dollars.

## Application

- `PORT` — defaults to `3000`.
- `BASE_URL` — defaults to `http://localhost:3000`.
- `NODE_ENV` — runtime mode.

Plant desks, tokens, and the call ledger are in `CREDENTIALS-desks.md` and
`CREDENTIALS-audit.md` in this same folder.
