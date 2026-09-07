'use strict';
// Every pricing/postage/stock rule from README.md and checkout-note.md, in one
// place. Nothing here ever trusts a client-supplied price, line total, or
// stock figure — every number is recomputed from the STORED variants row on
// every call. That is what makes a forged request body worthless, and it is
// also why the basket recalculates from its lines every time rather than
// storing a total: a stored total is a total that can disagree with the lines.

// A line's trade break applies once qty reaches tier_qty, and it applies to
// EVERY unit on that line — not a marginal discount above the threshold, and
// never a discount shared with any other line, even one with identical
// numbers. "Line" means this exact (sku, size) pair.
function priceLine(variant, qty) {
  const tradeApplied = qty >= variant.tier_qty;
  const unitPrice = tradeApplied ? variant.tier_price_pence : variant.price_pence;
  return {
    unit_price_pence: unitPrice,
    base_unit_price_pence: variant.price_pence,
    trade_applied: tradeApplied,
    tier_qty: variant.tier_qty,
    tier_price_pence: variant.tier_price_pence,
    units_to_unlock_trade: tradeApplied ? 0 : variant.tier_qty - qty,
    full_price_line_total_pence: variant.price_pence * qty,
    line_total_pence: unitPrice * qty,
    saving_pence: (variant.price_pence - unitPrice) * qty,
  };
}

// Postage is worked out from the basket's TOTAL weight, not per item: total
// the sheet weights, then take the FIRST band (by ascending upper bound)
// whose upper bound the total does not exceed. Over the last shippable band
// it is collection only — never a fallback to that last band's price.
function choosePostage(totalWeightGrams, bands) {
  const shippable = bands
    .filter((b) => b.band !== 'Collection')
    .slice()
    .sort((a, b) => a.up_to_grams - b.up_to_grams);
  for (const b of shippable) {
    if (totalWeightGrams <= b.up_to_grams) {
      return { band: b.band, price_pence: b.price_pence, collection_only: false, note: b.note };
    }
  }
  const collection = bands.find((b) => b.band === 'Collection') || {
    band: 'Collection',
    price_pence: 0,
    note: 'Over 2000g. Collection from the studio only.',
  };
  return { band: collection.band, price_pence: 0, collection_only: true, note: collection.note };
}

function weightFor(size, weights) {
  const w = weights.find((x) => x.size === size);
  return w ? w.grams : 0;
}

function getVariant(db, sku, size) {
  return db.prepare('SELECT * FROM variants WHERE sku = ? AND size = ?').get(String(sku || ''), String(size || ''));
}

function allBands(db) {
  return db.prepare('SELECT * FROM postage_bands ORDER BY sort_order').all();
}
function allWeights(db) {
  return db.prepare('SELECT * FROM size_weights').all();
}

// Normalizes and prices a raw basket ({lines:[{sku,size,qty}]}) against the
// CURRENT stored catalogue. Never reads a price/total from the request — only
// sku, size and the requested qty are taken from the client, and qty is
// capped (never exceeded) at the line's current in_stock, with a warning
// naming what is actually available. This is the "adding more than stock is
// refused" rule applied at basket-preview time.
function computeBasket(rawLines, db) {
  const bands = allBands(db);
  const weights = allWeights(db);
  const lines = [];
  const warnings = [];
  let subtotalPence = 0;
  let tradeSavingPence = 0;
  let totalWeight = 0;

  for (const raw of Array.isArray(rawLines) ? rawLines : []) {
    const sku = String((raw && raw.sku) || '').trim();
    const size = String((raw && raw.size) || '').trim();
    const variant = getVariant(db, sku, size);
    if (!variant) {
      warnings.push({ sku, size, code: 'UNKNOWN_LINE', message: `${sku} ${size} is not a line this shop sells.` });
      continue;
    }
    let qty = Math.floor(Number(raw && raw.qty));
    if (!Number.isFinite(qty) || qty < 0) qty = 0;
    const requested = qty;
    if (qty > variant.in_stock) {
      qty = variant.in_stock;
      warnings.push({
        sku,
        size,
        code: 'INSUFFICIENT_STOCK',
        message:
          variant.in_stock > 0
            ? `Only ${variant.in_stock} of ${variant.title} (${variant.size}) left; ${requested} was requested.`
            : `${variant.title} (${variant.size}) is sold out.`,
        available: variant.in_stock,
        requested,
      });
    }
    if (qty <= 0) continue;

    const priced = priceLine(variant, qty);
    subtotalPence += priced.full_price_line_total_pence;
    tradeSavingPence += priced.saving_pence;
    totalWeight += qty * weightFor(variant.size, weights);

    lines.push({
      sku: variant.sku,
      size: variant.size,
      title: variant.title,
      stock_sheet: variant.stock_sheet,
      image: variant.image,
      in_stock: variant.in_stock,
      qty,
      ...priced,
    });
  }

  const postage = lines.length ? choosePostage(totalWeight, bands) : { band: null, price_pence: 0, collection_only: false, note: null };
  const totalPence = subtotalPence - tradeSavingPence + (postage.collection_only ? 0 : postage.price_pence);

  return {
    lines,
    warnings,
    subtotal_pence: subtotalPence,
    trade_saving_pence: tradeSavingPence,
    weight_grams: totalWeight,
    postage,
    total_pence: totalPence,
  };
}

module.exports = {
  priceLine,
  choosePostage,
  weightFor,
  getVariant,
  allBands,
  allWeights,
  computeBasket,
};
