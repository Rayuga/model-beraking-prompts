'use strict';
// Ridgeline Press data layer. Opens the SQLite database, creates the schema
// and seeds it ONCE from the shop's own catalogue (variants.csv + postage.csv,
// loaded exactly, never re-typed) plus one synthetic historical order used to
// prove price-as-charged immutability. If the variants table is non-empty the
// seed returns immediately and nothing is reset, so state survives a restart.
//
// The golden reads its OWN co-located catalogue copy first (seed_data /
// src/seed/catalogue), so moving the shipped /catalogue mount can never break
// it — the same co-located-first pattern used across this fleet.
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DATA_DIR = process.env.RIDGELINE_DATA_DIR || path.join(__dirname, '..', 'data');
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'ridgeline.db');

function firstExisting(paths) {
  for (const p of paths) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

const CATALOGUE_DIR =
  process.env.CATALOGUE_DIR ||
  firstExisting([
    path.join(__dirname, 'seed', 'catalogue'),
    path.join(__dirname, '..', 'seed', 'catalogue'),
    path.join(__dirname, '..', 'catalogue'),
    '/catalogue',
  ]) ||
  '/catalogue';

// ---------------------------------------------------------------- CSV parser
// Small quote-aware CSV reader — postage.csv's note column embeds commas
// inside quotes ("A single A3, rolled in a sleeve."), so a plain split(',')
// is not safe.
function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}
function parseCsvBlock(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return [];
  const header = parseCsvLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    const row = {};
    header.forEach((h, i) => {
      row[h] = cells[i] === undefined ? '' : cells[i].trim();
    });
    return row;
  });
}

// variants.csv: one row per buyable LINE (sku+size), never per print.
function loadVariants(catalogueDir) {
  const text = fs.readFileSync(path.join(catalogueDir, 'variants.csv'), 'utf8');
  return parseCsvBlock(text).map((r) => ({
    sku: r.sku,
    title: r.title,
    size: r.size,
    stock_sheet: r.stock_sheet,
    price_pence: Number(r.price_pence),
    in_stock: Number(r.in_stock),
    tier_qty: Number(r.tier_qty),
    tier_price_pence: Number(r.tier_price_pence),
    // Served path — the raw catalogue path (prints/rp-101.png) is rewritten to
    // wherever the app actually serves the image from (see server static mount).
    image: '/images/' + path.basename(r.image),
  }));
}

// postage.csv is two tables separated by a blank line: postage bands, then a
// size -> weight lookup. Read it exactly as shipped rather than re-deriving it.
function loadPostage(catalogueDir) {
  const text = fs.readFileSync(path.join(catalogueDir, 'postage.csv'), 'utf8');
  const [bandsBlock, weightsBlock] = text.split(/\r?\n\s*\r?\n/);
  const bands = parseCsvBlock(bandsBlock).map((r, i) => ({
    band: r.band,
    up_to_grams: Number(r.up_to_grams),
    price_pence: Number(r.price_pence),
    note: r.note,
    sort_order: i,
  }));
  const weights = parseCsvBlock(weightsBlock).map((r) => ({
    size: r.size,
    grams: Number(r.grams),
  }));
  return { bands, weights };
}

function open() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  createSchema(db);
  seedIfEmpty(db);
  return db;
}

function createSchema(db) {
  db.exec(`
  CREATE TABLE IF NOT EXISTS variants (
    sku              TEXT NOT NULL,
    size             TEXT NOT NULL,
    title            TEXT NOT NULL,
    stock_sheet      TEXT NOT NULL,
    price_pence      INTEGER NOT NULL,
    in_stock         INTEGER NOT NULL,
    tier_qty         INTEGER NOT NULL,
    tier_price_pence INTEGER NOT NULL,
    image            TEXT NOT NULL,
    PRIMARY KEY (sku, size)
  );

  CREATE TABLE IF NOT EXISTS postage_bands (
    band         TEXT PRIMARY KEY,
    up_to_grams  INTEGER NOT NULL,
    price_pence  INTEGER NOT NULL,
    note         TEXT,
    sort_order   INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS size_weights (
    size  TEXT PRIMARY KEY,
    grams INTEGER NOT NULL
  );

  -- An order and its lines store the prices AS CHARGED at the moment the
  -- order was placed. Nothing here is ever recomputed from the live variants
  -- table after creation — that is the entire point of this table existing
  -- separately from variants.
  CREATE TABLE IF NOT EXISTS orders (
    reference          TEXT PRIMARY KEY,
    placed_at           TEXT NOT NULL,
    address_name        TEXT NOT NULL,
    address_line1       TEXT NOT NULL,
    address_line2       TEXT,
    address_city        TEXT NOT NULL,
    address_postcode    TEXT NOT NULL,
    address_country     TEXT NOT NULL,
    subtotal_pence       INTEGER NOT NULL,
    trade_saving_pence   INTEGER NOT NULL,
    weight_grams         INTEGER NOT NULL,
    postage_band         TEXT NOT NULL,
    postage_pence        INTEGER NOT NULL,
    collection_only       INTEGER NOT NULL DEFAULT 0,
    total_pence           INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS order_lines (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    order_reference        TEXT NOT NULL,
    sku                     TEXT NOT NULL,
    size                    TEXT NOT NULL,
    title                   TEXT NOT NULL,
    stock_sheet             TEXT NOT NULL,
    qty                     INTEGER NOT NULL,
    unit_price_pence        INTEGER NOT NULL,
    base_unit_price_pence   INTEGER NOT NULL,
    trade_applied           INTEGER NOT NULL DEFAULT 0,
    line_total_pence        INTEGER NOT NULL,
    FOREIGN KEY (order_reference) REFERENCES orders (reference)
  );

  CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL);
  `);
}

function seedIfEmpty(db) {
  const n = db.prepare('SELECT COUNT(*) AS c FROM variants').get().c;
  if (n > 0) return; // never re-seed: state (stock, placed orders) survives a restart

  const variants = loadVariants(CATALOGUE_DIR);
  const { bands, weights } = loadPostage(CATALOGUE_DIR);

  const tx = db.transaction(() => {
    const insVariant = db.prepare(
      `INSERT INTO variants (sku, size, title, stock_sheet, price_pence, in_stock, tier_qty, tier_price_pence, image)
       VALUES (@sku, @size, @title, @stock_sheet, @price_pence, @in_stock, @tier_qty, @tier_price_pence, @image)`
    );
    for (const v of variants) insVariant.run(v);

    const insBand = db.prepare(
      `INSERT INTO postage_bands (band, up_to_grams, price_pence, note, sort_order) VALUES (@band, @up_to_grams, @price_pence, @note, @sort_order)`
    );
    for (const b of bands) insBand.run(b);

    const insWeight = db.prepare('INSERT INTO size_weights (size, grams) VALUES (@size, @grams)');
    for (const w of weights) insWeight.run(w);

    // One synthetic historical order, authored by the restructurer (not part
    // of the shop's own catalogue data), that predates a price change on
    // RP-101 A3: it charged GBP 35.00 per sheet when that line's current
    // catalogue price is GBP 37.95. The confirmation and the record have to
    // agree a year later, so this order's stored figures must never be
    // recomputed from today's variants row.
    insertHistoricalOrder(db);

    db.prepare('INSERT INTO meta (k, v) VALUES (?, ?)').run('loaded', new Date().toISOString());
  });
  tx();
}

function insertHistoricalOrder(db) {
  const reference = 'RP-100001';
  db.prepare(
    `INSERT INTO orders
       (reference, placed_at, address_name, address_line1, address_line2, address_city, address_postcode, address_country,
        subtotal_pence, trade_saving_pence, weight_grams, postage_band, postage_pence, collection_only, total_pence)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    reference,
    '2026-05-04T09:15:00.000Z',
    'Elena Marsh',
    '14 Foundry Row',
    '',
    'Bristol',
    'BS1 4ND',
    'United Kingdom',
    7000, // subtotal_pence: 2 x 3500 (the OLD price)
    0, // trade_saving_pence: qty 2 is below this line's tier_qty of 3
    180, // weight_grams: 2 x 90g (A3)
    'Large letter',
    320,
    0,
    7320 // total_pence: 7000 - 0 + 320
  );
  db.prepare(
    `INSERT INTO order_lines
       (order_reference, sku, size, title, stock_sheet, qty, unit_price_pence, base_unit_price_pence, trade_applied, line_total_pence)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(reference, 'RP-101', 'A3', 'Long Field', 'Colorplan Pristine White 270gsm', 2, 3500, 3500, 0, 7000);
}

module.exports = {
  open,
  createSchema,
  seedIfEmpty,
  DB_PATH,
  DATA_DIR,
  CATALOGUE_DIR,
  parseCsvBlock,
};
