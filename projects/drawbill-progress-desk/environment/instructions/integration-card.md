# The card desk

The plant takes the card. The till never does.

- The card desk sits on the plant network with the other desks. Ask it for a
  session and send the payer to the card window it hands back.
- The browser has to end up on that window, on the desks' own origin, and
  come back to the app afterwards.
- The desk is the authority on whether the owner paid — ask it rather than
  believing the return trip. What it took has to be the plant's composed net
  from the live desks, not a grid subtotal and not a number the browser sent.
- The window takes the plant's test card `4242 4242 4242 4242`. The desk
  token is in `/assets/CREDENTIALS-desks.md` with the other desk credentials,
  and `VENDOR_TOKEN` overrides it when the box sets one. Keep it on the server,
  never in a file the browser is served.
