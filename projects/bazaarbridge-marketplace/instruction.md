# BazaarBridge marketplace operations

can you build me a polished full-stack operations app for BazaarBridge, a multi-vendor marketplace? I need a real backend server and persistent storage, not just a static dashboard. Include demo login accounts and show the signed-in person's role.

Let me move between Dashboard, Orders, Inventory, Returns and Payouts. I should be able to search and filter orders, open order details, create an order and update its status; create inventory and update stock; and create payouts and update their status. Keep a useful recent-activity trail and preserve changes across page reloads and new sign-in sessions. Include headline sales/orders/returns/payout metrics, light/dark mode, responsive behavior and accessible controls.

Put the application in `/app`. Build the backend with Node.js and Express, use SQLite for durable storage, and use the provided seed data at `/assets/artifacts/bazaarbridge_seed_data.json`. It must start with `node /app/server.js`, listen on port `3000`, serve the browser UI from `/app/public/index.html`, and store durable data in `/app/bazaarbridge.db`. The required server dependencies are already available in the environment; the running app must not install packages or require external network assets.

Provide these demo accounts with password `password123`:

- `admin@bazaarbridge.test` — Administrator
- `operator@bazaarbridge.test` — Operations lead
- `finance@bazaarbridge.test` — Finance manager
