Can you build the shop for Ridgeline Press, a risograph print studio? Use React, Node.js, Express and SQLite. It is public, with no accounts or sign-in, and each visitor keeps their own basket in the browser.

Read the studio notes in /instructions and the catalogue in /assets/seed_data.json before starting. The supplied photographs are the actual prints we sell. The notes explain the trade prices, postage, checkout and what happens when an order is cancelled; the catalogue supplies the prices and stock.

People should be able to browse a useful print grid, filter by paper size and stock sheet, sort by price or title, and search titles. Show the price and stock state on the grid, then a larger photograph and each size's paper, price, available quantity and trade break on the detail view. Each size has its own stock.

Give the basket and checkout a clear breakdown of the full-price subtotal, trade saving, postage and amount payable. Checkout collects a delivery address, shows the complete summary before the customer commits, and returns an order reference. There is no payment or card form. Customers can look up a reference later and cancel an order that has not been dispatched. Please pay particular attention to two people buying the last copies, a checkout request being retried, and a cancellation being clicked twice: the stock and receipt must still be right.

Make it comfortable on a phone and with a keyboard, with light and dark modes. Keep all required images, scripts, styles and other assets local so the delivered shop works without external network requests.

Put the finished app in /app. It starts with node /app/server.js, listens on 0.0.0.0:3000, serves /app/public/index.html, and answers GET /api/health promptly. Follow /instructions/integration.md for the supplied runtime and SQLite location.