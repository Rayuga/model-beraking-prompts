'use strict';
// Ridgeline Press HTTP layer — a public risograph print shop. No accounts, no
// sign-in: the basket lives in the browser (localStorage) and is re-priced by
// the server on every change, since the server is the only thing that ever
// holds authority over price and stock.
//
// Non-negotiables:
//  - /api/health answers immediately, never gated on seeding or the database.
//  - A price, line total, or stock figure claimed in a request body is a
//    CLAIM, never authority; every basket and every order is priced fresh
//    from the stored variants row.
//  - A placed order and its lines store the prices AS CHARGED. Nothing about
//    an order is ever recomputed from a later state of the variants table.
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const dbmod = require('./db');
const pricing = require('./pricing');

const app = express();
const PORT = Number(process.env.PORT || 3000);

// Health is answered before any DB access and is never gated on seeding.
app.get('/health', (_req, res) => res.json({ ok: true, service: 'ridgeline-press' }));
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'ridgeline-press' }));

let db = null;
try {
  db = dbmod.open();
} catch (e) {
  console.error('[ridgeline] database open failed:', e.message);
}

app.use(express.json({ limit: '1mb' }));
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
app.use(express.static(PUBLIC_DIR));

const bad = (res, code, msg, extra) => res.status(code).json({ error: msg, ...(extra || {}) });
const money = (pence) => `£${(Number(pence) / 100).toFixed(2)}`;

// ============================================================== catalogue
// Every print with all of its size lines, grouped by SKU, plus a "from"
// price and a buyable flag the grid can show without opening the print —
// buyable means AT LEAST ONE of its lines still has stock.
app.get('/api/prints', (_req, res) => {
  const rows = db.prepare('SELECT * FROM variants ORDER BY sku, size').all();
  const bySku = new Map();
  for (const r of rows) {
    if (!bySku.has(r.sku)) {
      bySku.set(r.sku, { sku: r.sku, title: r.title, image: r.image, sizes: [] });
    }
    bySku.get(r.sku).sizes.push({
      size: r.size,
      stock_sheet: r.stock_sheet,
      price_pence: r.price_pence,
      in_stock: r.in_stock,
      tier_qty: r.tier_qty,
      tier_price_pence: r.tier_price_pence,
    });
  }
  const prints = [...bySku.values()].map((p) => ({
    ...p,
    from_price_pence: Math.min(...p.sizes.map((s) => s.price_pence)),
    buyable: p.sizes.some((s) => s.in_stock > 0),
    paper_sheets: [...new Set(p.sizes.map((s) => s.stock_sheet))],
    available_sizes: [...new Set(p.sizes.map((s) => s.size))],
  }));
  res.json({ prints, postage_bands: pricing.allBands(db), size_weights: pricing.allWeights(db) });
});

app.get('/api/prints/:sku', (req, res) => {
  const rows = db.prepare('SELECT * FROM variants WHERE sku = ? ORDER BY size').all(req.params.sku.toUpperCase());
  if (!rows.length) return bad(res, 404, 'No such print.');
  res.json({
    sku: rows[0].sku,
    title: rows[0].title,
    image: rows[0].image,
    sizes: rows.map((r) => ({
      size: r.size,
      stock_sheet: r.stock_sheet,
      price_pence: r.price_pence,
      in_stock: r.in_stock,
      tier_qty: r.tier_qty,
      tier_price_pence: r.tier_price_pence,
    })),
  });
});

// ============================================================== basket
// Stateless by design: the client holds the raw lines (sku/size/qty) in its
// own browser storage and calls this on every change. The server is the only
// source of truth for price, trade-break status, and postage — nothing here
// is ever cached or stored server-side, so it can never drift from the lines.
app.post('/api/basket/price', (req, res) => {
  const lines = (req.body && req.body.lines) || [];
  res.json(pricing.computeBasket(lines, db));
});

// ============================================================== orders
function generateReference() {
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = 'RP-' + String(crypto.randomInt(100000, 999999));
    const exists = db.prepare('SELECT 1 FROM orders WHERE reference = ?').get(candidate);
    if (!exists) return candidate;
  }
  return 'RP-' + Date.now();
}

function orderView(reference) {
  const order = db.prepare('SELECT * FROM orders WHERE reference = ?').get(reference);
  if (!order) return null;
  const lines = db
    .prepare('SELECT * FROM order_lines WHERE order_reference = ? ORDER BY id')
    .all(reference);
  return { ...order, collection_only: !!order.collection_only, lines };
}

// The uplink-equivalent for a shop: validates the WHOLE order against
// CURRENT stock before touching anything, refuses the whole order (not a
// partial fulfillment) if any single line would go negative, then freezes
// every price into order_lines inside one transaction so a concurrent
// request can never see a half-written order.
app.post('/api/orders', (req, res) => {
  const body = req.body || {};
  const rawLines = Array.isArray(body.lines) ? body.lines : [];
  const address = body.address || {};

  const required = ['name', 'line1', 'city', 'postcode', 'country'];
  for (const field of required) {
    if (!String(address[field] || '').trim()) {
      return bad(res, 400, `A delivery address ${field} is required.`);
    }
  }

  try {
    const reference = db.transaction(() => {
      // Re-read every requested line's CURRENT stock inside the same
      // transaction, and refuse outright — never cap or partially fill — if
      // any single line would take stock below zero. Client-claimed prices,
      // totals, or trade-break status anywhere in the body are ignored: only
      // sku/size/qty are read, and price is always derived fresh from the
      // stored variants row below.
      const wanted = [];
      for (const raw of rawLines) {
        const sku = String((raw && raw.sku) || '').trim();
        const size = String((raw && raw.size) || '').trim();
        const qty = Math.floor(Number(raw && raw.qty));
        if (!sku || !size || !Number.isFinite(qty) || qty <= 0) continue;
        const variant = pricing.getVariant(db, sku, size);
        if (!variant) {
          const err = new Error(`${sku} ${size} is not a line this shop sells.`);
          err.code = 'UNKNOWN_LINE';
          throw err;
        }
        if (qty > variant.in_stock) {
          const err = new Error(
            variant.in_stock > 0
              ? `Only ${variant.in_stock} of ${variant.title} (${variant.size}) left; ${qty} was requested.`
              : `${variant.title} (${variant.size}) is sold out.`
          );
          err.code = 'INSUFFICIENT_STOCK';
          err.detail = { sku, size, available: variant.in_stock, requested: qty };
          throw err;
        }
        wanted.push({ variant, qty });
      }
      if (wanted.length === 0) {
        const err = new Error('Your basket is empty.');
        err.code = 'EMPTY_BASKET';
        throw err;
      }

      // Price every line fresh, from the stored catalogue, one last time —
      // this is the figure that gets frozen, regardless of anything the
      // request body claimed about price or total.
      const priced = wanted.map(({ variant, qty }) => ({ variant, qty, priced: pricing.priceLine(variant, qty) }));
      const bands = pricing.allBands(db);
      const weights = pricing.allWeights(db);
      const subtotalPence = priced.reduce((s, l) => s + l.priced.full_price_line_total_pence, 0);
      const tradeSavingPence = priced.reduce((s, l) => s + l.priced.saving_pence, 0);
      const weightGrams = priced.reduce((s, l) => s + l.qty * pricing.weightFor(l.variant.size, weights), 0);
      const postage = pricing.choosePostage(weightGrams, bands);
      const totalPence = subtotalPence - tradeSavingPence + (postage.collection_only ? 0 : postage.price_pence);

      const reference = generateReference();
      db.prepare(
        `INSERT INTO orders
           (reference, placed_at, address_name, address_line1, address_line2, address_city, address_postcode, address_country,
            subtotal_pence, trade_saving_pence, weight_grams, postage_band, postage_pence, collection_only, total_pence)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        reference,
        new Date().toISOString(),
        String(address.name).trim(),
        String(address.line1).trim(),
        address.line2 ? String(address.line2).trim() : null,
        String(address.city).trim(),
        String(address.postcode).trim(),
        String(address.country).trim(),
        subtotalPence,
        tradeSavingPence,
        weightGrams,
        postage.band,
        postage.price_pence,
        postage.collection_only ? 1 : 0,
        totalPence
      );
      const insLine = db.prepare(
        `INSERT INTO order_lines
           (order_reference, sku, size, title, stock_sheet, qty, unit_price_pence, base_unit_price_pence, trade_applied, line_total_pence)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      const decStock = db.prepare('UPDATE variants SET in_stock = in_stock - ? WHERE sku = ? AND size = ?');
      for (const l of priced) {
        insLine.run(
          reference,
          l.variant.sku,
          l.variant.size,
          l.variant.title,
          l.variant.stock_sheet,
          l.qty,
          l.priced.unit_price_pence,
          l.priced.base_unit_price_pence,
          l.priced.trade_applied ? 1 : 0,
          l.priced.line_total_pence
        );
        decStock.run(l.qty, l.variant.sku, l.variant.size);
      }
      return reference;
    })();

    res.status(201).json(orderView(reference));
  } catch (e) {
    if (e.code === 'INSUFFICIENT_STOCK' || e.code === 'UNKNOWN_LINE') {
      return bad(res, 409, e.message, e.detail);
    }
    if (e.code === 'EMPTY_BASKET') return bad(res, 400, e.message);
    console.error('[ridgeline] order failed:', e);
    return bad(res, 500, 'Could not place that order.');
  }
});

// The confirmation screen and the "track an order" lookup both read from
// here — a fresh GET against the stored record, never anything cached in the
// page. This is also what proves an order survives a reload: nothing about
// its display depends on in-memory state from the moment it was placed.
app.get('/api/orders/:reference', (req, res) => {
  const view = orderView(req.params.reference.toUpperCase());
  if (!view) return bad(res, 404, 'No order with that reference.');
  res.json(view);
});

// ================================================================= fallthrough
app.use('/api', (_req, res) => res.status(404).json({ error: 'no such endpoint' }));
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api/')) {
    const idx = path.join(PUBLIC_DIR, 'index.html');
    if (fs.existsSync(idx)) return res.sendFile(idx);
    return res.status(200).type('html').send('<!doctype html><title>App</title><p>Application is running.</p>');
  }
  next();
});

app.listen(PORT, '0.0.0.0', () => console.log(`[ridgeline] listening on ${PORT}`));
module.exports = app;
