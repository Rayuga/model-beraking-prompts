'use strict';
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'app.db');

function open() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH, { timeout: 5000 });
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS variants (
      sku TEXT NOT NULL, size TEXT NOT NULL, title TEXT NOT NULL, stock_sheet TEXT NOT NULL,
      price_pence INTEGER NOT NULL, in_stock INTEGER NOT NULL CHECK(in_stock >= 0),
      tier_qty INTEGER NOT NULL, tier_price_pence INTEGER NOT NULL, image TEXT NOT NULL,
      PRIMARY KEY(sku, size)
    );
    CREATE TABLE IF NOT EXISTS postage_bands (
      band TEXT PRIMARY KEY, up_to_grams INTEGER NOT NULL, price_pence INTEGER NOT NULL,
      note TEXT NOT NULL, sort_order INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS size_weights (size TEXT PRIMARY KEY, grams INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS orders (
      reference TEXT PRIMARY KEY, placed_at TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('placed','cancelled','dispatched')), cancelled_at TEXT,
      checkout_id TEXT UNIQUE, request_hash TEXT,
      address_name TEXT NOT NULL, address_line1 TEXT NOT NULL, address_line2 TEXT,
      address_city TEXT NOT NULL, address_postcode TEXT NOT NULL, address_country TEXT NOT NULL,
      subtotal_pence INTEGER NOT NULL, trade_saving_pence INTEGER NOT NULL,
      weight_grams INTEGER NOT NULL, postage_band TEXT NOT NULL, postage_pence INTEGER NOT NULL,
      collection_only INTEGER NOT NULL DEFAULT 0, total_pence INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS order_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT, order_reference TEXT NOT NULL,
      sku TEXT NOT NULL, size TEXT NOT NULL, title TEXT NOT NULL, stock_sheet TEXT NOT NULL,
      qty INTEGER NOT NULL CHECK(qty > 0), unit_price_pence INTEGER NOT NULL,
      base_unit_price_pence INTEGER NOT NULL, trade_applied INTEGER NOT NULL,
      line_total_pence INTEGER NOT NULL,
      UNIQUE(order_reference, sku, size),
      FOREIGN KEY(order_reference) REFERENCES orders(reference),
      FOREIGN KEY(sku, size) REFERENCES variants(sku, size)
    );
    CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL);
  `);
  db.transaction(() => {
    if (db.prepare("SELECT 1 FROM meta WHERE k='seeded'").get()) return;
    const seed = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'seed_data.json'), 'utf8'));
    const insertVariant = db.prepare(`INSERT INTO variants VALUES
      (@sku,@size,@title,@stock_sheet,@price_pence,@in_stock,@tier_qty,@tier_price_pence,@image)`);
    seed.variants.forEach(v => insertVariant.run({ ...v, image: '/images/' + path.basename(v.image) }));
    const insertBand = db.prepare('INSERT INTO postage_bands VALUES (@band,@up_to_grams,@price_pence,@note,@sort_order)');
    seed.postage_bands.forEach(b => insertBand.run(b));
    const insertWeight = db.prepare('INSERT INTO size_weights VALUES (@size,@grams)');
    seed.size_weights.forEach(w => insertWeight.run(w));
    for (const order of seed.orders) insertOrder(db, order);
    db.prepare('INSERT INTO meta VALUES (?,?)').run('seeded', 'ridgeline-1');
  }).immediate();
  return db;
}

function insertOrder(db, order) {
  db.prepare(`INSERT INTO orders (
    reference,placed_at,status,cancelled_at,checkout_id,request_hash,
    address_name,address_line1,address_line2,address_city,address_postcode,address_country,
    subtotal_pence,trade_saving_pence,weight_grams,postage_band,postage_pence,collection_only,total_pence
  ) VALUES (
    @reference,@placed_at,@status,@cancelled_at,@checkout_id,@request_hash,
    @address_name,@address_line1,@address_line2,@address_city,@address_postcode,@address_country,
    @subtotal_pence,@trade_saving_pence,@weight_grams,@postage_band,@postage_pence,@collection_only,@total_pence
  )`).run({ cancelled_at: null, checkout_id: null, request_hash: null, ...order });
  const insertLine = db.prepare(`INSERT INTO order_lines (
    order_reference,sku,size,title,stock_sheet,qty,unit_price_pence,base_unit_price_pence,trade_applied,line_total_pence
  ) VALUES (@order_reference,@sku,@size,@title,@stock_sheet,@qty,@unit_price_pence,@base_unit_price_pence,@trade_applied,@line_total_pence)`);
  order.lines.forEach(l => insertLine.run({ ...l, order_reference: order.reference, trade_applied: Number(l.trade_applied) }));
}
module.exports = { open, insertOrder, DB_PATH };
