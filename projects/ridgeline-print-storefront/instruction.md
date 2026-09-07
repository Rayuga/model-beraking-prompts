# Ridgeline Press print shop

can you build me the shop front for Ridgeline Press, a risograph print studio? React, built with Vite and styled with Tailwind, on a SQLite database — no accounts and no sign-in, it's a public shop, and the basket should live in the browser for whoever is looking.

Everything the shop sells is in `/catalogue`: a photograph of every print in `catalogue/prints`, one buyable line per paper size in `variants.csv`, the postage bands in `postage.csv`, and `catalogue/README.md` and `catalogue/checkout-note.md` writing up the pricing, the trade break, postage, the basket and the order — read both and follow them precisely, the numbers there are authoritative over anything a request body or the UI might suggest. Load the catalogue exactly and use the real images; a grid of grey rectangles isn't the brief.

The listing grid needs to sell prints, so give the images room: filter by paper size and stock sheet, sort by price and title, search titles, and show a price and whether it can be bought without making anyone open it. Opening a print should show the image large with its sizes, papers and prices.

Stock and price are per line, not per print — a print whose A3 has sold out should still sell its A2. Show a line's trade break before anyone reaches it, and show that it has applied once they do.

Then a checkout collecting a delivery address and a final summary with the same figures — no payment step, no card details, and the last screen is a confirmation with a reference.

Light and dark mode, keyboard-navigable, and responsive down to a phone, please. Nothing should be fetched over the network.

Put the app in `/app`, build the backend with Node.js and Express, and use SQLite for durable storage. It must start with `node /app/server.js`, listen on port `3000`, expose a successful `GET /api/health` before any database work blocks startup, and serve the browser UI from `/app/public/index.html`. Required dependencies are already available — the running app must not install packages or fetch anything external.
