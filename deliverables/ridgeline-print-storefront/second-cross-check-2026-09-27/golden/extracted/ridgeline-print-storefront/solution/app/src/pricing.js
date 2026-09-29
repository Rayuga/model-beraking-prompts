'use strict';
function fault(message, code = 'INVALID_BASKET', detail = {}) {
  return Object.assign(new Error(message), { code, detail, status: 409 });
}
function normalizeLines(rawLines, allowZero = false) {
  if (!Array.isArray(rawLines) || rawLines.length > 100) throw fault('Provide a basket of print quantities.');
  const grouped = new Map();
  for (const raw of rawLines) {
    if (!raw || typeof raw !== 'object') throw fault('Each basket line needs a print, size and whole-number quantity.');
    const sku = typeof raw.sku === 'string' ? raw.sku.trim().toUpperCase() : '';
    const size = typeof raw.size === 'string' ? raw.size.trim().toUpperCase() : '';
    const qty = typeof raw.qty === 'number' || (typeof raw.qty === 'string' && raw.qty.trim()) ? Number(raw.qty) : NaN;
    if (!sku || !size || !Number.isSafeInteger(qty) || qty < (allowZero ? 0 : 1)) {
      throw fault('Quantities must be whole numbers; remove unwanted lines before placing an order.', 'INVALID_QUANTITY');
    }
    const key = sku + ':' + size;
    const total = (grouped.get(key)?.qty || 0) + qty;
    if (!Number.isSafeInteger(total)) throw fault('That quantity is too large.', 'INVALID_QUANTITY');
    grouped.set(key, { sku, size, qty: total });
  }
  return [...grouped.values()].sort((a,b) => (a.sku + a.size).localeCompare(b.sku + b.size));
}
function priceLine(variant, qty) {
  const tradeApplied = qty >= variant.tier_qty;
  const unitPrice = tradeApplied ? variant.tier_price_pence : variant.price_pence;
  return {
    unit_price_pence: unitPrice, base_unit_price_pence: variant.price_pence,
    trade_applied: tradeApplied, tier_qty: variant.tier_qty, tier_price_pence: variant.tier_price_pence,
    units_to_unlock_trade: tradeApplied ? 0 : variant.tier_qty - qty,
    full_price_line_total_pence: variant.price_pence * qty,
    line_total_pence: unitPrice * qty, saving_pence: (variant.price_pence - unitPrice) * qty
  };
}
function allBands(db) { return db.prepare('SELECT * FROM postage_bands ORDER BY sort_order').all(); }
function allWeights(db) { return db.prepare('SELECT * FROM size_weights ORDER BY size').all(); }
function getVariant(db,sku,size) { return db.prepare('SELECT * FROM variants WHERE sku=? AND size=?').get(sku,size); }
function choosePostage(weight,bands) {
  const band = bands.filter(b => b.up_to_grams > 0).sort((a,b) => a.up_to_grams-b.up_to_grams)
    .find(b => weight <= b.up_to_grams) || bands.find(b => b.band === 'Collection');
  return { band:band.band, price_pence:band.price_pence, collection_only:band.band==='Collection', note:band.note };
}
function computeBasket(rawLines,db,allowZero=true) {
  const wanted = normalizeLines(rawLines,allowZero);
  const weights = Object.fromEntries(allWeights(db).map(w => [w.size,w.grams]));
  const lines = [];
  for (const raw of wanted) {
    const variant = getVariant(db,raw.sku,raw.size);
    if (!variant) throw fault(`${raw.sku} ${raw.size} is not a print variant we sell.`,'UNKNOWN_LINE');
    if (raw.qty > variant.in_stock) {
      throw fault(`Only ${variant.in_stock} of ${variant.title} (${variant.size}) available; ${raw.qty} requested.`,
        'INSUFFICIENT_STOCK',{sku:raw.sku,size:raw.size,available:variant.in_stock,requested:raw.qty});
    }
    if (raw.qty) lines.push({...variant,qty:raw.qty,...priceLine(variant,raw.qty)});
  }
  const subtotal_pence = lines.reduce((s,l) => s+l.full_price_line_total_pence,0);
  const trade_saving_pence = lines.reduce((s,l) => s+l.saving_pence,0);
  const weight_grams = lines.reduce((s,l) => s+l.qty*weights[l.size],0);
  const postage = lines.length ? choosePostage(weight_grams,allBands(db)) : {band:null,price_pence:0,collection_only:false,note:''};
  return {lines,warnings:[],subtotal_pence,trade_saving_pence,weight_grams,postage,
    total_pence:subtotal_pence-trade_saving_pence+postage.price_pence};
}
module.exports = {fault,normalizeLines,priceLine,allBands,allWeights,getVariant,choosePostage,computeBasket};
