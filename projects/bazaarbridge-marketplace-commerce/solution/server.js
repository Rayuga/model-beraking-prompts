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

const ORDER_STATUSES = new Set(["New", "Packed", "Shipped", "On hold", "Returned", "Cancelled"]);
const PAYOUT_STATUSES = new Set(["Requested", "Review", "Approved", "Paid", "Stale"]);
const REFUND_STATUSES = new Set(["Requested", "Approved", "Paid"]);
const RETURN_STATUSES = new Set(["Requested", "Received", "Approved", "Rejected"]);
const SHIPMENT_STEPS = ["CREATED", "PICKED", "IN_TRANSIT", "DELIVERED"];
const ROLES = ["Administrator", "Operations lead", "Warehouse lead", "Finance manager", "Finance checker", "Compliance officer", "Merchant", "Viewer"];
const ORDER_TRANSITIONS = {
  New: ["Packed", "On hold", "Cancelled"],
  Packed: ["Shipped", "Cancelled"],
  "On hold": ["Packed", "Cancelled"],
  Returned: [],
  Cancelled: [],
};
const COMMISSION_BANDS = [
  { limit: 150, rate: 0.12 },
  { limit: 300, rate: 0.09 },
  { limit: Infinity, rate: 0.06 },
];
const PROCESSING_RATE = 0.029;
const PROCESSING_FLAT = 0.3;
const HIGH_VALUE_THRESHOLD = 10000;
const RETURN_WINDOW_DAYS = 30;
const RETURN_WINDOW_MS = RETURN_WINDOW_DAYS * 86400000;

let parsedSeed = null;
try {
  parsedSeed = JSON.parse(fs.readFileSync(SEED_PATH, "utf8"));
} catch (_error) {
  parsedSeed = null;
}
const clockSetting = process.env.SIMULATION_CLOCK
  || (parsedSeed && typeof parsedSeed.clock === "string" ? parsedSeed.clock : null);
const fixedClockMs = Number.isFinite(Date.parse(String(clockSetting || "")))
  ? Date.parse(String(clockSetting))
  : Number.NaN;
const simulationNowMs = () => (Number.isFinite(fixedClockMs) ? fixedClockMs : Date.now());
const formatSqlTimestamp = (ms) => new Date(ms).toISOString().replace("T", " ").replace("Z", "");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");

const hashPassword = (value) => crypto.createHash("sha256").update(String(value)).digest("hex");
const now = () => formatSqlTimestamp(simulationNowMs());
const roundCents = (value) => Math.floor(Number(value) * 100 + 0.5) / 100;
const moneyEqual = (a, b) => Math.abs(Number(a) - Number(b)) < 0.005;

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function nonNegativeInteger(value, label, positive = false) {
  if (value === "" || value === null || value === undefined) {
    throw httpError(400, `${label} is required`);
  }
  const number = Number(value);
  if (!Number.isInteger(number) || number < (positive ? 1 : 0)) {
    throw httpError(400, `${label} must be ${positive ? "a positive" : "a non-negative"} integer`);
  }
  return number;
}

function wholeDollar(value, label) {
  if (value === "" || value === null || value === undefined) {
    throw httpError(400, `${label} is required`);
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || !Number.isInteger(number)) {
    throw httpError(400, `${label} must be a whole, non-negative dollar amount`);
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
      role TEXT NOT NULL,
      merchant_id TEXT,
      active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS merchants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL,
      frozen_reason TEXT,
      bank_last4 TEXT NOT NULL,
      bank_token TEXT NOT NULL,
      ledger_version INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS hubs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS products (
      sku TEXT PRIMARY KEY,
      sku_norm TEXT UNIQUE NOT NULL,
      product TEXT NOT NULL,
      merchant_id TEXT NOT NULL REFERENCES merchants(id),
      hub_id TEXT NOT NULL REFERENCES hubs(id),
      price REAL NOT NULL CHECK(price >= 0),
      stock INTEGER NOT NULL CHECK(stock >= 0),
      reserved INTEGER NOT NULL CHECK(reserved >= 0),
      reorder_level INTEGER NOT NULL CHECK(reorder_level >= 0),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      customer TEXT NOT NULL,
      merchant_id TEXT NOT NULL REFERENCES merchants(id),
      sku TEXT NOT NULL REFERENCES products(sku),
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      unit_price REAL NOT NULL CHECK(unit_price >= 0),
      total REAL NOT NULL CHECK(total >= 0),
      status TEXT NOT NULL,
      hub_id TEXT NOT NULL REFERENCES hubs(id),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      delivered_at TEXT,
      return_until TEXT
    );
    CREATE TABLE IF NOT EXISTS shipments (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id),
      hub_id TEXT NOT NULL REFERENCES hubs(id),
      status TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS returns (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id),
      reason TEXT NOT NULL,
      status TEXT NOT NULL,
      requested_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS refunds (
      id TEXT PRIMARY KEY,
      return_id TEXT NOT NULL REFERENCES returns(id),
      amount REAL NOT NULL CHECK(amount >= 0),
      status TEXT NOT NULL,
      maker_email TEXT NOT NULL,
      checker_email TEXT,
      retry_key TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS payouts (
      id TEXT PRIMARY KEY,
      merchant_id TEXT NOT NULL REFERENCES merchants(id),
      amount REAL NOT NULL CHECK(amount >= 0),
      status TEXT NOT NULL,
      maker_email TEXT NOT NULL,
      checker_email TEXT,
      retry_key TEXT UNIQUE NOT NULL,
      ledger_version INTEGER NOT NULL,
      breakdown TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      email TEXT NOT NULL REFERENCES users(email),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      detail TEXT NOT NULL,
      actor TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      previous_state TEXT,
      new_state TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  if (db.prepare("SELECT COUNT(*) AS count FROM users").get().count !== 0) return;
  const seed = parsedSeed || JSON.parse(fs.readFileSync(SEED_PATH, "utf8"));
  const insertUser = db.prepare("INSERT INTO users(email,password_hash,name,role,merchant_id,active) VALUES(?,?,?,?,?,?)");
  const insertMerchant = db.prepare("INSERT INTO merchants(id,name,status,frozen_reason,bank_last4,bank_token,ledger_version) VALUES(?,?,?,?,?,?,?)");
  const insertHub = db.prepare("INSERT INTO hubs(id,name) VALUES(?,?)");
  const insertProduct = db.prepare("INSERT INTO products(sku,sku_norm,product,merchant_id,hub_id,price,stock,reserved,reorder_level,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)");
  const insertOrder = db.prepare("INSERT INTO orders(id,customer,merchant_id,sku,quantity,unit_price,total,status,hub_id,created_at,delivered_at,return_until) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)");
  const insertPayout = db.prepare("INSERT INTO payouts(id,merchant_id,amount,status,maker_email,checker_email,retry_key,ledger_version,breakdown,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)");
  const insertActivity = db.prepare("INSERT INTO activity(action,detail,actor,entity,entity_id,previous_state,new_state,created_at) VALUES(?,?,?,?,?,?,?,?)");

  db.transaction(() => {
    for (const user of seed.users) insertUser.run(user.email, hashPassword(user.password), user.name, user.role, user.merchant_id, user.active ? 1 : 0);
    for (const merchant of seed.merchants) insertMerchant.run(merchant.id, merchant.name, merchant.status, merchant.frozen_reason, merchant.bank_last4, merchant.bank_token, merchant.ledger_version);
    for (const hub of seed.hubs) insertHub.run(hub.id, hub.name);
    for (const product of seed.products) insertProduct.run(product.sku, product.sku.toUpperCase(), product.product, product.merchant_id, product.hub_id, product.price, product.stock, product.reserved, product.reorder_level, now());
    for (const order of seed.orders) insertOrder.run(order.id, order.customer, order.merchant_id, order.sku, order.quantity, order.unit_price, order.total, order.status, order.hub_id, order.created_at, order.delivered_at, order.return_until);
    for (const payout of seed.payouts) insertPayout.run(payout.id, payout.merchant_id, payout.amount, payout.status, payout.maker_email, payout.checker_email, payout.retry_key, payout.ledger_version, JSON.stringify(payout.breakdown), payout.created_at);
    for (const event of seed.activity) insertActivity.run(event.action, event.detail, event.actor, event.entity, event.entity_id, event.previous_state, event.new_state, event.created_at);
  })();
}

function addActivity(action, detail, actor, entity, entityId, previousState, newState) {
  db.prepare("INSERT INTO activity(action,detail,actor,entity,entity_id,previous_state,new_state,created_at) VALUES(?,?,?,?,?,?,?,?)").run(
    action, detail, actor, entity, String(entityId || ""), previousState || null, newState || null, now()
  );
}

function requireRole(user, roles, subject) {
  if (!roles.includes(user.role)) {
    throw httpError(403, `Not authorised: a ${user.role} cannot change ${subject}`);
  }
}

function isActiveMerchant(merchantId) {
  const merchant = db.prepare("SELECT status FROM merchants WHERE id=?").get(merchantId);
  return merchant && merchant.status === "active";
}

function getOrder(id) {
  return db.prepare("SELECT * FROM orders WHERE id=?").get(id) || null;
}

function merchantName(id) {
  const row = db.prepare("SELECT name FROM merchants WHERE id=?").get(id);
  return row ? row.name : id;
}

function productRow(sku) {
  return db.prepare("SELECT * FROM products WHERE lower(sku)=lower(?)").get(sku) || null;
}

function commissionRate(total) {
  return COMMISSION_BANDS.find((band) => Number(total) < band.limit).rate;
}

function settlementLine(order) {
  const total = Number(order.total);
  const rate = commissionRate(total);
  const commission = roundCents(total * rate);
  const processing = roundCents(roundCents(total * PROCESSING_RATE) + PROCESSING_FLAT);
  return {
    id: order.id,
    sku: order.sku,
    quantity: order.quantity,
    total,
    commission_rate: rate,
    commission,
    processing,
    net: roundCents(total - commission - processing),
  };
}

function statementsForOrders(orders) {
  const byMerchant = new Map();
  for (const order of orders) {
    if (order.status !== "Shipped") continue;
    const list = byMerchant.get(order.merchant_id) || [];
    list.push(order);
    byMerchant.set(order.merchant_id, list);
  }
  const rows = [];
  for (const [merchantId, list] of byMerchant) {
    const lines = list.map(settlementLine);
    const sum = (key) => roundCents(lines.reduce((total, line) => total + line[key], 0));
    rows.push({
      merchant_id: merchantId,
      merchant: merchantName(merchantId),
      orders: lines,
      gross: sum("total"),
      commission: sum("commission"),
      processing: sum("processing"),
      net_payable: sum("net"),
    });
  }
  return rows.sort((a, b) => a.merchant.localeCompare(b.merchant));
}

function settlementSummary(orders) {
  const statements = statementsForOrders(orders);
  return {
    statements,
    owed_to_merchants: roundCents(statements.reduce((sum, row) => sum + row.net_payable, 0)),
    gross_sales: roundCents(orders.reduce((sum, order) => sum + Number(order.total), 0)),
    order_count: orders.length,
  };
}

function merchantNet(merchantId) {
  const orders = db.prepare("SELECT * FROM orders WHERE merchant_id=? AND status='Shipped'").all(merchantId);
  return roundCents(orders.reduce((sum, order) => sum + settlementLine(order).net, 0));
}

function merchantBreakdown(merchantId) {
  const orders = db.prepare("SELECT * FROM orders WHERE merchant_id=? AND status='Shipped' ORDER BY id").all(merchantId);
  const lines = orders.map(settlementLine);
  const sum = (key) => roundCents(lines.reduce((total, line) => total + line[key], 0));
  return {
    orders: lines,
    gross: sum("total"),
    commission: sum("commission"),
    processing: sum("processing"),
    net: sum("net"),
  };
}

function bumpLedger(merchantId) {
  db.prepare("UPDATE merchants SET ledger_version = ledger_version + 1 WHERE id=?").run(merchantId);
}

function voidOutdatedPayoutApprovals(merchantId, actorName) {
  const merchant = db.prepare("SELECT ledger_version FROM merchants WHERE id=?").get(merchantId);
  if (!merchant) return;
  const outdated = db.prepare(
    "SELECT * FROM payouts WHERE merchant_id=? AND status='Approved' AND ledger_version < ?"
  ).all(merchantId, merchant.ledger_version);
  for (const payout of outdated) {
    db.prepare("UPDATE payouts SET status='Stale' WHERE id=? AND status='Approved'").run(payout.id);
    addActivity("Payout approval invalidated", `${payout.id} · ${merchantName(merchantId)}`, actorName, "payout", payout.id, "Approved", "Stale");
  }
}

function consumeReservation(order) {
  const product = productRow(order.sku);
  if (!product || Number(product.stock) < Number(order.quantity)) {
    throw httpError(409, `Cannot ship ${order.id}: not enough stock on hand`);
  }
  db.prepare("UPDATE products SET stock = stock - ?, reserved = MAX(0, reserved - ?) WHERE sku=?").run(order.quantity, order.quantity, product.sku);
}

function releaseReservation(order) {
  db.prepare("UPDATE products SET reserved = MAX(0, reserved - ?) WHERE sku=?").run(order.quantity, order.sku);
}

function restock(order) {
  db.prepare("UPDATE products SET stock = stock + ? WHERE sku=?").run(order.quantity, order.sku);
}

function deliveredDeadlineMs(order) {
  if (!order || !order.delivered_at) return null;
  const deliveredMs = Date.parse(String(order.delivered_at).replace(" ", "T") + "Z");
  return Number.isFinite(deliveredMs) ? deliveredMs + RETURN_WINDOW_MS : null;
}

function returnUntilFor(deliveredSql) {
  const deliveredMs = Date.parse(String(deliveredSql || "").replace(" ", "T") + "Z");
  const baseMs = Number.isFinite(deliveredMs) ? deliveredMs : simulationNowMs();
  return formatSqlTimestamp(baseMs + RETURN_WINDOW_MS);
}

function returnEligible(order) {
  if (!order || order.status !== "Shipped" || !order.delivered_at) return false;
  const deadlineMs = deliveredDeadlineMs(order);
  return deadlineMs !== null && deadlineMs >= simulationNowMs();
}

function maskMerchant(row, user) {
  const merchant = { id: row.id, name: row.name, status: row.status, frozen_reason: row.frozen_reason, bank_last4: row.bank_last4, bank_token: "••••••••" };
  if (user.role === "Merchant" && user.merchant_id !== row.id) return null;
  return merchant;
}

function scopedOrders(user) {
  if (user.merchant_id) return db.prepare("SELECT * FROM orders WHERE merchant_id=? ORDER BY created_at DESC, id DESC").all(user.merchant_id);
  return db.prepare("SELECT * FROM orders ORDER BY created_at DESC, id DESC").all();
}

function scopedProducts(user) {
  if (user.merchant_id) return db.prepare("SELECT * FROM products WHERE merchant_id=? ORDER BY sku").all(user.merchant_id);
  return db.prepare("SELECT * FROM products ORDER BY sku").all();
}

function scopedPayouts(user) {
  if (user.merchant_id) return db.prepare("SELECT * FROM payouts WHERE merchant_id=? ORDER BY created_at DESC, id DESC").all(user.merchant_id);
  return db.prepare("SELECT * FROM payouts ORDER BY created_at DESC, id DESC").all();
}

function permissionsFor(user) {
  const role = user.role;
  return {
    is_merchant: role === "Merchant",
    can_orders: role === "Administrator" || role === "Operations lead",
    can_inventory: role === "Administrator" || role === "Operations lead",
    can_products: role === "Administrator" || role === "Operations lead",
    can_warehouse: role === "Administrator" || role === "Warehouse lead",
    can_finance_request: role === "Administrator" || role === "Finance manager",
    can_finance_check: role === "Administrator" || role === "Finance checker",
    can_freeze: role === "Administrator" || role === "Compliance officer",
    can_admin: role === "Administrator",
    can_bank_tokens: role === "Finance checker",
  };
}

function buildSnapshot(user) {
  const orders = scopedOrders(user);
  const products = scopedProducts(user);
  const payouts = scopedPayouts(user);
  const summary = settlementSummary(orders);
  const merchants = db.prepare("SELECT * FROM merchants ORDER BY name").all().map((row) => maskMerchant(row, user)).filter(Boolean);
  const readyPayout = roundCents(payouts.filter((payout) => payout.status === "Approved").reduce((sum, payout) => sum + Number(payout.amount), 0));
  const activityRows = db.prepare("SELECT * FROM activity ORDER BY datetime(created_at) DESC, id DESC LIMIT 500").all();
  const activity = user.merchant_id
    ? activityRows.filter((row) => row.detail.includes(merchantName(user.merchant_id)))
    : activityRows;
  const returns = user.merchant_id
    ? db.prepare("SELECT r.* FROM returns r JOIN orders o ON o.id=r.order_id WHERE o.merchant_id=? ORDER BY r.created_at DESC").all(user.merchant_id)
    : db.prepare("SELECT * FROM returns ORDER BY created_at DESC").all();
  const returnIds = returns.map((row) => row.id);
  const refunds = user.merchant_id
    ? db.prepare(`SELECT r.* FROM refunds r WHERE r.return_id IN (${returnIds.map(() => "?").join(",") || "''"}) ORDER BY r.created_at DESC`).all(...returnIds)
    : db.prepare("SELECT * FROM refunds ORDER BY created_at DESC").all();
  const shipments = user.merchant_id
    ? db.prepare("SELECT s.* FROM shipments s JOIN orders o ON o.id=s.order_id WHERE o.merchant_id=? ORDER BY s.created_at DESC").all(user.merchant_id)
    : db.prepare("SELECT * FROM shipments ORDER BY created_at DESC").all();
  const lowStockCount = products.filter((product) => Number(product.stock) <= Number(product.reorder_level)).length;
  return {
    user,
    permissions: permissionsFor(user),
    metrics: {
      gross_sales: summary.gross_sales,
      order_count: summary.order_count,
      ready_payout: readyPayout,
      owed_to_merchants: summary.owed_to_merchants,
      low_stock_count: lowStockCount,
    },
    merchants,
    hubs: db.prepare("SELECT * FROM hubs ORDER BY name").all(),
    products,
    orders,
    payouts,
    settlements: summary.statements,
    activity,
    returns,
    refunds,
    shipments,
  };
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
      ? db.prepare(`
          SELECT u.id,u.email,u.name,u.role,u.merchant_id
          FROM sessions s JOIN users u ON u.email=s.email
          WHERE s.token=? AND u.active=1
        `).get(token)
      : null;
    if (!user) throw httpError(401, "Authentication required");
    req.token = token;
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "BazaarBridge", store: "sqlite" }));

app.post("/api/login", (req, res, next) => {
  try {
    const email = String(req.body?.email || "").trim().toLowerCase();
    const user = db.prepare("SELECT * FROM users WHERE lower(email)=?").get(email);
    if (!user || user.password_hash !== hashPassword(req.body?.password || "") || !user.active) {
      throw httpError(401, "Invalid email or password");
    }
    const token = crypto.randomBytes(24).toString("base64url");
    db.prepare("INSERT INTO sessions(token,email,created_at) VALUES(?,?,?)").run(token, user.email, now());
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, merchant_id: user.merchant_id } });
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
    res.json(buildSnapshot(req.user));
  } catch (error) {
    next(error);
  }
});

app.post("/api/products", authenticate, (req, res, next) => {
  try {
    requireRole(req.user, ["Administrator", "Operations lead"], "products");
    const sku = String(req.body?.sku || "").trim();
    const product = String(req.body?.product || "").trim();
    const merchantId = String(req.body?.merchant_id || "").trim();
    const hubId = String(req.body?.hub_id || "").trim();
    const price = wholeDollar(req.body?.price, "Price");
    const stock = nonNegativeInteger(req.body?.stock, "Stock");
    const reorderLevel = nonNegativeInteger(req.body?.reorder_level, "Reorder level");
    if (!sku || !product || !merchantId || !hubId) throw httpError(400, "SKU, product, merchant and hub are required");
    const merchant = db.prepare("SELECT id FROM merchants WHERE id=?").get(merchantId);
    const hub = db.prepare("SELECT id FROM hubs WHERE id=?").get(hubId);
    if (!merchant || !hub) throw httpError(400, "Unknown merchant or hub");
    if (db.prepare("SELECT sku FROM products WHERE sku_norm=?").get(sku.toUpperCase())) {
      throw httpError(409, "A product with that SKU already exists");
    }
    db.transaction(() => {
      db.prepare("INSERT INTO products(sku,sku_norm,product,merchant_id,hub_id,price,stock,reserved,reorder_level,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)").run(
        sku, sku.toUpperCase(), product, merchantId, hubId, price, stock, 0, reorderLevel, now()
      );
      addActivity("Product created", `${sku} · ${merchantName(merchantId)}`, req.user.name, "product", sku, null, `${price.toFixed(2)}`);
    })();
    res.status(201).json(productRow(sku));
  } catch (error) {
    next(error);
  }
});

app.patch("/api/inventory/:sku", authenticate, (req, res, next) => {
  try {
    requireRole(req.user, ["Administrator", "Operations lead"], "inventory stock");
    const product = productRow(req.params.sku);
    if (!product) throw httpError(404, "Product not found");
    const stock = nonNegativeInteger(req.body?.stock, "Stock");
    const reason = String(req.body?.reason || "").trim();
    if (!reason) throw httpError(400, "A reason is required to change stock");
    if (product.stock === stock) return res.json(productRow(product.sku));
    db.transaction(() => {
      db.prepare("UPDATE products SET stock=? WHERE sku=?").run(stock, product.sku);
      addActivity("Stock updated", `${product.sku} · to ${stock} units`, req.user.name, "product", product.sku, String(product.stock), String(stock));
    })();
    res.json(productRow(product.sku));
  } catch (error) {
    next(error);
  }
});

app.post("/api/orders", authenticate, (req, res, next) => {
  try {
    requireRole(req.user, ["Administrator", "Operations lead"], "orders");
    const customer = String(req.body?.customer || "").trim();
    const sku = String(req.body?.sku || "").trim();
    const quantity = nonNegativeInteger(req.body?.quantity, "Quantity", true);
    if (!customer) throw httpError(400, "Customer is required");
    const product = productRow(sku);
    if (!product) throw httpError(404, "Product not found");
    const merchant = db.prepare("SELECT * FROM merchants WHERE id=?").get(product.merchant_id);
    if (!merchant) throw httpError(404, "Merchant not found");
    const available = Number(product.stock) - Number(product.reserved);
    if (quantity > available) throw httpError(409, `Only ${available} units of ${product.sku} are available`);
    const id = `BB-${2000 + db.prepare("SELECT COUNT(*) AS count FROM orders").get().count + 1}`;
    const total = roundCents(Number(product.price) * quantity);
    db.transaction(() => {
      db.prepare("UPDATE products SET reserved = reserved + ? WHERE sku=?").run(quantity, product.sku);
      db.prepare("INSERT INTO orders(id,customer,merchant_id,sku,quantity,unit_price,total,status,hub_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)").run(
        id, customer, product.merchant_id, product.sku, quantity, product.price, total, "New", product.hub_id, now()
      );
      addActivity("Order created", `${id} · ${merchant.name}`, req.user.name, "order", id, null, "New");
    })();
    res.status(201).json(getOrder(id));
  } catch (error) {
    next(error);
  }
});

app.patch("/api/orders/:id", authenticate, (req, res, next) => {
  try {
    requireRole(req.user, ["Administrator", "Operations lead"], "order status");
    const order = getOrder(req.params.id);
    if (!order) throw httpError(404, "Order not found");
    const status = String(req.body?.status || "");
    if (!ORDER_STATUSES.has(status)) throw httpError(400, "Invalid order status");
    if (order.status === status) return res.json(order);
    const allowed = ORDER_TRANSITIONS[order.status] || [];
    if (!allowed.includes(status)) throw httpError(409, `Cannot move ${order.id} from ${order.status} to ${status}`);
    db.transaction(() => {
      if (status === "Shipped") {
        consumeReservation(order);
        const deliveredAt = now();
        db.prepare("UPDATE orders SET status=?, delivered_at=?, return_until=? WHERE id=?").run(status, deliveredAt, returnUntilFor(deliveredAt), order.id);
        bumpLedger(order.merchant_id);
        voidOutdatedPayoutApprovals(order.merchant_id, req.user.name);
        addActivity("Order shipped", `${order.id} · ${merchantName(order.merchant_id)}`, req.user.name, "order", order.id, order.status, status);
      } else if (status === "Returned") {
        db.prepare("UPDATE orders SET status=? WHERE id=?").run(status, order.id);
        restock(order);
        releaseReservation(order);
        addActivity("Order returned", `${order.id} · ${merchantName(order.merchant_id)}`, req.user.name, "order", order.id, order.status, status);
      } else if (status === "Cancelled") {
        db.prepare("UPDATE orders SET status=? WHERE id=?").run(status, order.id);
        releaseReservation(order);
        addActivity("Order cancelled", `${order.id} · ${merchantName(order.merchant_id)}`, req.user.name, "order", order.id, order.status, status);
      } else {
        db.prepare("UPDATE orders SET status=? WHERE id=?").run(status, order.id);
        addActivity(`Order moved to ${status}`, `${order.id} · ${merchantName(order.merchant_id)}`, req.user.name, "order", order.id, order.status, status);
      }
    })();
    res.json(getOrder(order.id));
  } catch (error) {
    next(error);
  }
});

app.post("/api/shipments", authenticate, (req, res, next) => {
  try {
    requireRole(req.user, ["Administrator", "Warehouse lead"], "shipments");
    const order = getOrder(String(req.body?.order_id || ""));
    if (!order) throw httpError(404, "Order not found");
    if (order.status !== "Packed") throw httpError(409, "Only packed orders can be shipped");
    const existing = db.prepare("SELECT * FROM shipments WHERE order_id=? AND status != 'DELIVERED'").get(order.id);
    if (existing) throw httpError(409, "This order already has an active shipment");
    const requestedHub = String(req.body?.hub_id || order.hub_id);
    if (requestedHub !== order.hub_id) throw httpError(400, "The shipment hub must match the order's hub");
    const id = `SH-${db.prepare("SELECT COUNT(*) AS count FROM shipments").get().count + 1}`;
    const hub = db.prepare("SELECT name FROM hubs WHERE id=?").get(order.hub_id);
    db.transaction(() => {
      db.prepare("INSERT INTO shipments(id,order_id,hub_id,status,created_at,updated_at) VALUES(?,?,?,?,?,?)").run(id, order.id, order.hub_id, "CREATED", now(), now());
      addActivity("Shipment created", `${id} · ${order.id} · ${hub.name}`, req.user.name, "shipment", id, null, "CREATED");
    })();
    res.status(201).json(db.prepare("SELECT * FROM shipments WHERE id=?").get(id));
  } catch (error) {
    next(error);
  }
});

app.patch("/api/shipments/:id/step", authenticate, (req, res, next) => {
  try {
    requireRole(req.user, ["Administrator", "Warehouse lead"], "shipment steps");
    const shipment = db.prepare("SELECT * FROM shipments WHERE id=?").get(req.params.id);
    if (!shipment) throw httpError(404, "Shipment not found");
    if (shipment.status === "DELIVERED") throw httpError(409, "A delivered shipment is complete and cannot change");
    const step = String(req.body?.step || "").toUpperCase();
    const currentIndex = SHIPMENT_STEPS.indexOf(shipment.status);
    const nextIndex = SHIPMENT_STEPS.indexOf(step);
    if (nextIndex !== currentIndex + 1) throw httpError(409, "Shipment steps must happen in order");
    const order = getOrder(shipment.order_id);
    db.transaction(() => {
      db.prepare("UPDATE shipments SET status=?, updated_at=? WHERE id=?").run(step, now(), shipment.id);
      addActivity("Shipment step", `${shipment.id} · ${step}`, req.user.name, "shipment", shipment.id, shipment.status, step);
      if (step === "DELIVERED") {
        if (!order || order.status !== "Packed") throw httpError(409, "The order is not ready to be delivered");
        consumeReservation(order);
        const deliveredAt = now();
        db.prepare("UPDATE orders SET status='Shipped', delivered_at=?, return_until=? WHERE id=?").run(
          deliveredAt, returnUntilFor(deliveredAt), order.id
        );
        bumpLedger(order.merchant_id);
        voidOutdatedPayoutApprovals(order.merchant_id, req.user.name);
        addActivity("Order shipped", `${order.id} · ${merchantName(order.merchant_id)}`, req.user.name, "order", order.id, order.status, "Shipped");
      }
    })();
    res.json(db.prepare("SELECT * FROM shipments WHERE id=?").get(shipment.id));
  } catch (error) {
    next(error);
  }
});

app.post("/api/returns", authenticate, (req, res, next) => {
  try {
    requireRole(req.user, ["Administrator", "Operations lead"], "returns");
    const order = getOrder(String(req.body?.order_id || ""));
    const reason = String(req.body?.reason || "").trim();
    if (!order) throw httpError(404, "Order not found");
    if (!reason) throw httpError(400, "A reason is required");
    if (!returnEligible(order)) throw httpError(409, `Return window closed for ${order.id}`);
    const existing = db.prepare("SELECT id FROM returns WHERE order_id=?").get(order.id);
    if (existing) throw httpError(409, "A return already exists for this order");
    const id = `RET-${db.prepare("SELECT COUNT(*) AS count FROM returns").get().count + 1}`;
    db.transaction(() => {
      db.prepare("INSERT INTO returns(id,order_id,reason,status,requested_by,created_at) VALUES(?,?,?,?,?,?)").run(id, order.id, reason, "Requested", req.user.email, now());
      addActivity("Return requested", `${id} · ${order.id} · ${merchantName(order.merchant_id)}`, req.user.name, "return", id, "Shipped", "Requested");
    })();
    res.status(201).json(db.prepare("SELECT * FROM returns WHERE id=?").get(id));
  } catch (error) {
    next(error);
  }
});

app.post("/api/returns/:id/receipt", authenticate, (req, res, next) => {
  try {
    requireRole(req.user, ["Administrator", "Warehouse lead"], "return receipts");
    const record = db.prepare("SELECT * FROM returns WHERE id=?").get(req.params.id);
    if (!record) throw httpError(404, "Return not found");
    if (record.status === "Received") return res.json(record);
    if (record.status !== "Requested") throw httpError(409, "This return cannot be received");
    const order = getOrder(record.order_id);
    if (!order || order.status !== "Shipped") throw httpError(409, "The order is not Shipped and cannot become Returned");
    db.transaction(() => {
      db.prepare("UPDATE returns SET status='Received' WHERE id=?").run(record.id);
      addActivity("Return received", `${record.id} · ${record.order_id}`, req.user.name, "return", record.id, record.status, "Received");
      restock(order);
      releaseReservation(order);
      db.prepare("UPDATE orders SET status='Returned' WHERE id=?").run(order.id);
      addActivity("Order returned", `${order.id} · ${merchantName(order.merchant_id)}`, req.user.name, "order", order.id, order.status, "Returned");
    })();
    res.json(db.prepare("SELECT * FROM returns WHERE id=?").get(record.id));
  } catch (error) {
    next(error);
  }
});

app.post("/api/refunds", authenticate, (req, res, next) => {
  try {
    requireRole(req.user, ["Administrator", "Finance manager"], "refund requests");
    const record = db.prepare("SELECT * FROM returns WHERE id=?").get(String(req.body?.return_id || ""));
    if (!record) throw httpError(404, "Return not found");
    if (record.status !== "Received") throw httpError(409, "The return has not been received by the warehouse");
    const key = String(req.body?.retry_key || `ref-${crypto.randomBytes(8).toString("hex")}`);
    const existing = db.prepare("SELECT * FROM refunds WHERE retry_key=?").get(key);
    if (existing) return res.json(existing);
    const order = getOrder(record.order_id);
    const amount = Number(order.total);
    const id = `RF-${db.prepare("SELECT COUNT(*) AS count FROM refunds").get().count + 1}`;
    db.transaction(() => {
      db.prepare("INSERT INTO refunds(id,return_id,amount,status,maker_email,checker_email,retry_key,created_at) VALUES(?,?,?,?,?,?,?,?)").run(
        id, record.id, amount, "Requested", req.user.email, null, key, now()
      );
      addActivity("Refund requested", `${id} · ${order.id} · ${amount.toFixed(2)}`, req.user.name, "refund", id, null, "Requested");
    })();
    res.status(201).json(db.prepare("SELECT * FROM refunds WHERE id=?").get(id));
  } catch (error) {
    next(error);
  }
});

app.patch("/api/refunds/:id/approve", authenticate, (req, res, next) => {
  try {
    requireRole(req.user, ["Administrator", "Finance checker"], "refund approvals");
    const refund = db.prepare("SELECT * FROM refunds WHERE id=?").get(req.params.id);
    if (!refund) throw httpError(404, "Refund not found");
    if (refund.status === "Approved") return res.json(refund);
    if (refund.status === "Paid") throw httpError(409, "A paid refund is terminal");
    if (refund.maker_email === req.user.email) throw httpError(403, "The person who requested a refund cannot approve it");
    const record = db.prepare("SELECT * FROM returns WHERE id=?").get(refund.return_id);
    if (!record || record.status !== "Received") throw httpError(409, "The return has not been received by the warehouse");
    db.transaction(() => {
      db.prepare("UPDATE refunds SET status='Approved', checker_email=? WHERE id=?").run(req.user.email, refund.id);
      addActivity("Refund approved", `${refund.id} · ${refund.amount.toFixed(2)}`, req.user.name, "refund", refund.id, refund.status, "Approved");
    })();
    res.json(db.prepare("SELECT * FROM refunds WHERE id=?").get(refund.id));
  } catch (error) {
    next(error);
  }
});

app.patch("/api/refunds/:id/paid", authenticate, (req, res, next) => {
  try {
    requireRole(req.user, ["Administrator", "Finance checker"], "refund payments");
    const refund = db.prepare("SELECT * FROM refunds WHERE id=?").get(req.params.id);
    if (!refund) throw httpError(404, "Refund not found");
    if (refund.status === "Paid") throw httpError(409, "A paid refund is terminal");
    if (refund.status !== "Approved") throw httpError(409, "Only approved refunds can be paid");
    db.transaction(() => {
      db.prepare("UPDATE refunds SET status='Paid' WHERE id=?").run(refund.id);
      addActivity("Refund paid", `${refund.id} · ${refund.amount.toFixed(2)}`, req.user.name, "refund", refund.id, refund.status, "Paid");
    })();
    res.json(db.prepare("SELECT * FROM refunds WHERE id=?").get(refund.id));
  } catch (error) {
    next(error);
  }
});

app.post("/api/payouts/request", authenticate, (req, res, next) => {
  try {
    requireRole(req.user, ["Administrator", "Finance manager"], "payout requests");
    const merchantId = String(req.body?.merchant_id || "").trim();
    const merchant = db.prepare("SELECT * FROM merchants WHERE id=?").get(merchantId);
    if (!merchant) throw httpError(404, "Merchant not found");
    if (merchant.status === "frozen") throw httpError(403, `${merchant.name} is frozen and cannot receive a payout`);
    const breakdown = merchantBreakdown(merchantId);
    if (breakdown.net <= 0) throw httpError(400, "There is no payable balance for this merchant");
    const key = String(req.body?.retry_key || `pay-${crypto.randomBytes(8).toString("hex")}`);
    const existing = db.prepare("SELECT * FROM payouts WHERE retry_key=?").get(key);
    if (existing) return res.json(existing);
    const id = `PAY-${db.prepare("SELECT COUNT(*) AS count FROM payouts").get().count + 1}`;
    db.transaction(() => {
      db.prepare("INSERT INTO payouts(id,merchant_id,amount,status,maker_email,checker_email,retry_key,ledger_version,breakdown,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)").run(
        id, merchantId, breakdown.net, "Requested", req.user.email, null, key, merchant.ledger_version, JSON.stringify(breakdown), now()
      );
      addActivity("Payout requested", `${id} · ${merchant.name} · ${breakdown.net.toFixed(2)}`, req.user.name, "payout", id, null, "Requested");
    })();
    res.status(201).json(db.prepare("SELECT * FROM payouts WHERE id=?").get(id));
  } catch (error) {
    next(error);
  }
});

app.patch("/api/payouts/:id/approve", authenticate, (req, res, next) => {
  try {
    requireRole(req.user, ["Administrator", "Finance checker"], "payout approvals");
    const payout = db.prepare("SELECT * FROM payouts WHERE id=?").get(req.params.id);
    if (!payout) throw httpError(404, "Payout not found");
    if (payout.status === "Paid") throw httpError(409, "A paid payout is terminal");
    if (payout.maker_email === req.user.email) throw httpError(403, "The person who requested a payout cannot approve it");
    const merchant = db.prepare("SELECT * FROM merchants WHERE id=?").get(payout.merchant_id);
    if (!merchant || merchant.status === "frozen") throw httpError(403, `${merchant ? merchant.name : "The merchant"} is frozen`);
    if (payout.status === "Stale") throw httpError(409, "Payout approval invalidated by a ledger change; request a fresh payout");
    if (Number(payout.ledger_version) !== Number(merchant.ledger_version)) {
      db.transaction(() => {
        db.prepare("UPDATE payouts SET status='Stale' WHERE id=?").run(payout.id);
        addActivity("Payout approval invalidated", `${payout.id} · ${merchant.name}`, req.user.name, "payout", payout.id, "Approved", "Stale");
      })();
      throw httpError(409, "Payout approval invalidated by a ledger change; request a fresh payout");
    }
    if (payout.status === "Approved") return res.json(payout);
    if (!["Requested", "Review"].includes(payout.status)) throw httpError(409, "This payout cannot be approved");
    db.transaction(() => {
      db.prepare("UPDATE payouts SET status='Approved', checker_email=? WHERE id=?").run(req.user.email, payout.id);
      addActivity("Payout approved", `${payout.id} · ${merchant.name} · ${payout.amount.toFixed(2)}`, req.user.name, "payout", payout.id, payout.status, "Approved");
    })();
    res.json(db.prepare("SELECT * FROM payouts WHERE id=?").get(payout.id));
  } catch (error) {
    next(error);
  }
});

app.patch("/api/payouts/:id/release", authenticate, (req, res, next) => {
  try {
    requireRole(req.user, ["Administrator", "Finance checker"], "payout releases");
    const payout = db.prepare("SELECT * FROM payouts WHERE id=?").get(req.params.id);
    if (!payout) throw httpError(404, "Payout not found");
    if (payout.status === "Paid") throw httpError(409, "A paid payout is terminal");
    const merchant = db.prepare("SELECT * FROM merchants WHERE id=?").get(payout.merchant_id);
    if (!merchant || merchant.status === "frozen") throw httpError(403, `${merchant ? merchant.name : "The merchant"} is frozen`);
    if (payout.status !== "Approved") throw httpError(409, "Only approved payouts can be released");
    db.transaction(() => {
      db.prepare("UPDATE payouts SET status='Paid' WHERE id=?").run(payout.id);
      addActivity("Payout paid", `${payout.id} · ${merchant.name} · ${payout.amount.toFixed(2)}`, req.user.name, "payout", payout.id, payout.status, "Paid");
    })();
    res.json(db.prepare("SELECT * FROM payouts WHERE id=?").get(payout.id));
  } catch (error) {
    next(error);
  }
});

app.post("/api/merchants/:id/freeze", authenticate, (req, res, next) => {
  try {
    requireRole(req.user, ["Administrator", "Compliance officer"], "merchant freezes");
    const merchant = db.prepare("SELECT * FROM merchants WHERE id=?").get(req.params.id);
    const reason = String(req.body?.reason || "").trim();
    if (!merchant) throw httpError(404, "Merchant not found");
    if (!reason) throw httpError(400, "A reason is required to freeze a merchant");
    if (merchant.status === "frozen") throw httpError(409, "Merchant is already frozen");
    db.transaction(() => {
      db.prepare("UPDATE merchants SET status='frozen', frozen_reason=? WHERE id=?").run(reason, merchant.id);
      addActivity("Merchant frozen", `${merchant.id} · ${merchant.name} · ${reason}`, req.user.name, "merchant", merchant.id, merchant.status, "frozen");
    })();
    res.json(maskMerchant(db.prepare("SELECT * FROM merchants WHERE id=?").get(merchant.id), req.user));
  } catch (error) {
    next(error);
  }
});

app.post("/api/merchants/:id/unfreeze", authenticate, (req, res, next) => {
  try {
    requireRole(req.user, ["Administrator", "Compliance officer"], "merchant unfreezes");
    const merchant = db.prepare("SELECT * FROM merchants WHERE id=?").get(req.params.id);
    const reason = String(req.body?.reason || "").trim();
    if (!merchant) throw httpError(404, "Merchant not found");
    if (!reason) throw httpError(400, "A reason is required to unfreeze a merchant");
    if (merchant.status !== "frozen") throw httpError(409, "Merchant is not frozen");
    db.transaction(() => {
      db.prepare("UPDATE merchants SET status='active', frozen_reason=NULL WHERE id=?").run(merchant.id);
      addActivity("Merchant unfrozen", `${merchant.id} · ${merchant.name} · ${reason}`, req.user.name, "merchant", merchant.id, merchant.status, "active");
    })();
    res.json(maskMerchant(db.prepare("SELECT * FROM merchants WHERE id=?").get(merchant.id), req.user));
  } catch (error) {
    next(error);
  }
});

app.get("/api/admin/users", authenticate, (req, res, next) => {
  try {
    if (req.user.role === "Merchant") {
      throw httpError(403, "Only platform staff can view the people directory");
    }
    res.json(db.prepare("SELECT id,email,name,role,merchant_id,active FROM users ORDER BY id").all());
  } catch (error) {
    next(error);
  }
});

app.patch("/api/admin/users/:id/role", authenticate, (req, res, next) => {
  try {
    requireRole(req.user, ["Administrator"], "user roles");
    const user = db.prepare("SELECT * FROM users WHERE id=?").get(req.params.id);
    const role = String(req.body?.role || "");
    if (!user) throw httpError(404, "User not found");
    if (!ROLES.includes(role)) throw httpError(400, "Invalid role");
    db.transaction(() => {
      db.prepare("UPDATE users SET role=? WHERE id=?").run(role, user.id);
      addActivity("User role changed", `${user.email} · ${role}`, req.user.name, "user", String(user.id), user.role, role);
    })();
    res.json(db.prepare("SELECT id,email,name,role,merchant_id,active FROM users WHERE id=?").get(user.id));
  } catch (error) {
    next(error);
  }
});

app.patch("/api/admin/users/:id/suspend", authenticate, (req, res, next) => {
  try {
    requireRole(req.user, ["Administrator"], "user suspension");
    const user = db.prepare("SELECT * FROM users WHERE id=?").get(req.params.id);
    if (!user) throw httpError(404, "User not found");
    db.transaction(() => {
      db.prepare("UPDATE users SET active=0 WHERE id=?").run(user.id);
      db.prepare("DELETE FROM sessions WHERE email=?").run(user.email);
      addActivity("User suspended", `${user.email}`, req.user.name, "user", String(user.id), "active", "suspended");
    })();
    res.json({ id: user.id, active: 0 });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/admin/users/:id/activate", authenticate, (req, res, next) => {
  try {
    requireRole(req.user, ["Administrator"], "user activation");
    const user = db.prepare("SELECT * FROM users WHERE id=?").get(req.params.id);
    if (!user) throw httpError(404, "User not found");
    db.transaction(() => {
      db.prepare("UPDATE users SET active=1 WHERE id=?").run(user.id);
      addActivity("User activated", `${user.email}`, req.user.name, "user", String(user.id), "suspended", "active");
    })();
    res.json({ id: user.id, active: 1 });
  } catch (error) {
    next(error);
  }
});

app.get("/api/finance/bank-tokens", authenticate, (req, res, next) => {
  try {
    requireRole(req.user, ["Finance checker"], "bank token lookup");
    res.json(db.prepare("SELECT id,name,bank_last4,bank_token FROM merchants ORDER BY name").all());
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
  const message = error.code === "SQLITE_CONSTRAINT_UNIQUE"
    ? "That record already exists"
    : (error.code === "SQLITE_CONSTRAINT" ? "That record conflicts with existing data" : (error.message || "Request failed"));
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
