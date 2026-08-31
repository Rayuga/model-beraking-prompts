"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const Database = require("better-sqlite3");

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DB_PATH = process.env.DB_PATH || path.join(ROOT, "bazaarbridge.db");
const SEED_PATH = process.env.SEED_PATH || path.join(ROOT, "seed_data.json");
const PORT = Number(process.env.PORT || 3000);
const ORDER_STATUSES = new Set(["New", "Packed", "Shipped", "Returned", "On hold"]);
const PAYOUT_STATUSES = new Set(["Requested", "Approved", "Released", "Review"]);

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");

const hashPassword = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");
const now = () => new Date().toISOString().replace("T", " ").replace("Z", "");

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function requiredText(value, label) {
  const text = String(value ?? "").trim();
  if (!text) throw httpError(400, `${label} is required`);
  return text;
}

function nonNegativeNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw httpError(400, `${label} must be non-negative`);
  return number;
}

function nonNegativeInteger(value, label, positive = false) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < (positive ? 1 : 0)) {
    throw httpError(400, `${label} must be ${positive ? "positive" : "a non-negative integer"}`);
  }
  return number;
}

function initialize() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      email TEXT NOT NULL REFERENCES users(email),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS inventory (
      sku TEXT PRIMARY KEY,
      product TEXT NOT NULL,
      merchant TEXT NOT NULL,
      hub TEXT NOT NULL,
      stock INTEGER NOT NULL CHECK(stock >= 0),
      reorder_level INTEGER NOT NULL CHECK(reorder_level >= 0)
    );
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      customer TEXT NOT NULL,
      merchant TEXT NOT NULL,
      product TEXT NOT NULL,
      status TEXT NOT NULL,
      total REAL NOT NULL CHECK(total >= 0),
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS payouts (
      id TEXT PRIMARY KEY,
      merchant TEXT NOT NULL,
      amount REAL NOT NULL CHECK(amount >= 0),
      status TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      detail TEXT NOT NULL,
      actor TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  if (db.prepare("SELECT COUNT(*) AS count FROM users").get().count !== 0) return;
  const seed = JSON.parse(fs.readFileSync(SEED_PATH, "utf8"));
  const insertUser = db.prepare("INSERT INTO users(email,password_hash,name,role) VALUES(?,?,?,?)");
  const insertInventory = db.prepare("INSERT INTO inventory(sku,product,merchant,hub,stock,reorder_level) VALUES(?,?,?,?,?,?)");
  const insertOrder = db.prepare("INSERT INTO orders(id,customer,merchant,product,status,total,quantity,created_at) VALUES(?,?,?,?,?,?,?,?)");
  const insertPayout = db.prepare("INSERT INTO payouts(id,merchant,amount,status,created_at) VALUES(?,?,?,?,?)");
  const insertActivity = db.prepare("INSERT INTO activity(action,detail,actor,created_at) VALUES(?,?,?,?)");
  db.transaction(() => {
    for (const user of seed.users) insertUser.run(user.email, hashPassword(user.password), user.name, user.role);
    for (const item of seed.inventory) insertInventory.run(item.sku, item.product, item.merchant, item.hub, item.stock, item.reorder_level);
    for (const order of seed.orders) insertOrder.run(order.id, order.customer, order.merchant, order.product, order.status, order.total, order.quantity, order.created_at);
    for (const payout of seed.payouts) insertPayout.run(payout.id, payout.merchant, payout.amount, payout.status, payout.created_at);
    for (const event of seed.activity) insertActivity.run(event.action, event.detail, event.actor, event.created_at);
  })();
}

function addActivity(action, detail, actor) {
  db.prepare("INSERT INTO activity(action,detail,actor,created_at) VALUES(?,?,?,?)").run(action, detail, actor, now());
}

function nextId(table, prefix) {
  if (!new Set(["orders", "payouts"]).has(table)) throw new Error("Unsupported ID table");
  const rows = db.prepare(`SELECT id FROM ${table}`).all();
  const numbers = rows
    .map(({ id }) => new RegExp(`^${prefix}-(\\d+)$`).exec(id))
    .filter(Boolean)
    .map((match) => Number(match[1]));
  return `${prefix}-${Math.max(1000, ...numbers) + 1}`;
}

function requireRole(user, roles) {
  if (!roles.includes(user.role)) throw httpError(403, "Insufficient role");
}

initialize();
const app = express();
app.disable("x-powered-by");
app.use((req, res, next) => {
  res.set({
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:",
  });
  next();
});
app.use(express.json({ limit: "1mb" }));

function authenticate(req, res, next) {
  try {
    const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    const user = token
      ? db.prepare("SELECT u.email,u.name,u.role FROM sessions s JOIN users u ON u.email=s.email WHERE s.token=?").get(token)
      : null;
    if (!user) throw httpError(401, "Authentication required");
    req.token = token;
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "BazaarBridge" }));

app.post("/api/login", (req, res, next) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const user = db.prepare("SELECT email,name,role,password_hash FROM users WHERE lower(email)=?").get(email);
    if (!user || user.password_hash !== hashPassword(req.body?.password || "")) {
      throw httpError(401, "Invalid email or password");
    }
    const token = crypto.randomBytes(24).toString("base64url");
    db.prepare("INSERT INTO sessions(token,email,created_at) VALUES(?,?,?)").run(token, user.email, now());
    res.json({ token, user: { email: user.email, name: user.name, role: user.role } });
  } catch (error) {
    next(error);
  }
});

app.post("/api/logout", authenticate, (req, res) => {
  db.prepare("DELETE FROM sessions WHERE token=?").run(req.token);
  res.json({ ok: true });
});

app.get("/api/bootstrap", authenticate, (req, res, next) => {
  try {
    const orders = db.prepare("SELECT * FROM orders ORDER BY id DESC").all();
    const inventory = db.prepare("SELECT * FROM inventory ORDER BY sku").all();
    const payouts = db.prepare("SELECT * FROM payouts ORDER BY id DESC").all();
    const activity = db.prepare("SELECT * FROM activity ORDER BY datetime(created_at) DESC, id DESC LIMIT 12").all();
    const grossSales = Math.round(orders.reduce((sum, order) => sum + Number(order.total), 0) * 100) / 100;
    const returned = orders.filter((order) => order.status === "Returned").length;
    const readyPayout = Math.round(payouts.filter((payout) => ["Approved", "Released"].includes(payout.status)).reduce((sum, payout) => sum + Number(payout.amount), 0) * 100) / 100;
    res.json({
      user: req.user,
      metrics: {
        gross_sales: grossSales,
        orders: orders.length,
        return_rate: orders.length ? Math.round((returned / orders.length) * 1000) / 10 : 0,
        ready_payout: readyPayout,
      },
      orders,
      inventory,
      payouts,
      activity,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/orders", authenticate, (req, res, next) => {
  try {
    requireRole(req.user, ["Administrator", "Operations lead"]);
    const customer = requiredText(req.body?.customer, "Customer");
    const merchant = requiredText(req.body?.merchant, "Merchant");
    const product = requiredText(req.body?.product, "Product");
    const quantity = nonNegativeInteger(req.body?.quantity, "Quantity", true);
    const total = nonNegativeNumber(req.body?.total, "Total");
    const id = nextId("orders", "BB");
    db.transaction(() => {
      db.prepare("INSERT INTO orders(id,customer,merchant,product,status,total,quantity,created_at) VALUES(?,?,?,?,?,?,?,?)")
        .run(id, customer, merchant, product, "New", total, quantity, now());
      addActivity("Order created", `${id} · ${merchant}`, req.user.name);
    })();
    res.status(201).json({ id });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/orders/:id", authenticate, (req, res, next) => {
  try {
    requireRole(req.user, ["Administrator", "Operations lead"]);
    const status = String(req.body?.status || "");
    if (!ORDER_STATUSES.has(status)) throw httpError(400, "Invalid order status");
    const order = db.prepare("SELECT merchant FROM orders WHERE id=?").get(req.params.id);
    if (!order) throw httpError(404, "Order not found");
    db.transaction(() => {
      db.prepare("UPDATE orders SET status=? WHERE id=?").run(status, req.params.id);
      addActivity(`Order moved to ${status}`, `${req.params.id} · ${order.merchant}`, req.user.name);
    })();
    res.json({ id: req.params.id, status });
  } catch (error) {
    next(error);
  }
});

app.post("/api/inventory", authenticate, (req, res, next) => {
  try {
    requireRole(req.user, ["Administrator", "Operations lead"]);
    const sku = requiredText(req.body?.sku, "SKU");
    const product = requiredText(req.body?.product, "Product");
    const merchant = requiredText(req.body?.merchant, "Merchant");
    const hub = requiredText(req.body?.hub, "Hub");
    const stock = nonNegativeInteger(req.body?.stock, "Stock");
    const reorderLevel = nonNegativeInteger(req.body?.reorder_level, "Reorder level");
    db.transaction(() => {
      db.prepare("INSERT INTO inventory(sku,product,merchant,hub,stock,reorder_level) VALUES(?,?,?,?,?,?)")
        .run(sku, product, merchant, hub, stock, reorderLevel);
      addActivity("Inventory created", `${sku} · ${product}`, req.user.name);
    })();
    res.status(201).json({ sku });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/inventory/:sku", authenticate, (req, res, next) => {
  try {
    requireRole(req.user, ["Administrator", "Operations lead"]);
    const stock = nonNegativeInteger(req.body?.stock, "Stock");
    const result = db.transaction(() => {
      const update = db.prepare("UPDATE inventory SET stock=? WHERE sku=?").run(stock, req.params.sku);
      if (update.changes !== 1) throw httpError(404, "Inventory item not found");
      addActivity("Stock updated", `${req.params.sku} · ${stock} units`, req.user.name);
      return update;
    })();
    if (result.changes !== 1) throw httpError(404, "Inventory item not found");
    res.json({ sku: req.params.sku, stock });
  } catch (error) {
    next(error);
  }
});

app.post("/api/payouts", authenticate, (req, res, next) => {
  try {
    requireRole(req.user, ["Administrator", "Finance manager"]);
    const merchant = requiredText(req.body?.merchant, "Merchant");
    const amount = nonNegativeNumber(req.body?.amount, "Amount");
    const id = nextId("payouts", "PAY");
    db.transaction(() => {
      db.prepare("INSERT INTO payouts(id,merchant,amount,status,created_at) VALUES(?,?,?,?,?)")
        .run(id, merchant, amount, "Requested", now());
      addActivity("Payout created", `${id} · ${merchant}`, req.user.name);
    })();
    res.status(201).json({ id });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/payouts/:id", authenticate, (req, res, next) => {
  try {
    requireRole(req.user, ["Administrator", "Finance manager"]);
    const status = String(req.body?.status || "");
    if (!PAYOUT_STATUSES.has(status)) throw httpError(400, "Invalid payout status");
    const payout = db.prepare("SELECT merchant FROM payouts WHERE id=?").get(req.params.id);
    if (!payout) throw httpError(404, "Payout not found");
    db.transaction(() => {
      db.prepare("UPDATE payouts SET status=? WHERE id=?").run(status, req.params.id);
      addActivity(`Payout moved to ${status}`, `${req.params.id} · ${payout.merchant}`, req.user.name);
    })();
    res.json({ id: req.params.id, status });
  } catch (error) {
    next(error);
  }
});

app.use(express.static(PUBLIC_DIR, { index: "index.html", etag: false, lastModified: false }));
app.use((req, res, next) => {
  if (req.method === "GET" && !req.path.startsWith("/api/")) {
    return res.sendFile(path.join(PUBLIC_DIR, "index.html"));
  }
  next(httpError(404, "Not found"));
});
app.use((error, _req, res, _next) => {
  const message = error.code === "SQLITE_CONSTRAINT_UNIQUE" ? "That record already exists" : (error.message || "Request failed");
  res.status(Number(error.status) || (String(error.code || "").startsWith("SQLITE_CONSTRAINT") ? 400 : 500)).json({ error: message });
});

const server = app.listen(PORT, "0.0.0.0", () => console.log(`BazaarBridge listening on ${PORT}`));
function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
