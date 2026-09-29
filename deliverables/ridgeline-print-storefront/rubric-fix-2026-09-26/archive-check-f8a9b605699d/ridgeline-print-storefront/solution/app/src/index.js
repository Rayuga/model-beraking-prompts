'use strict';
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const dbmod = require('./db');
const pricing = require('./pricing');
const app = express();
const db = dbmod.open();
const publicDir = path.join(__dirname,'..','public');

app.disable('x-powered-by');
app.use(express.json({limit:'100kb'}));
app.use('/api',(_req,res,next) => { res.set('Cache-Control','no-store'); next(); });
app.get('/api/health',(_req,res) => res.json({ok:true,service:'ridgeline-press'}));
app.use(express.static(publicDir));
app.get('/api/prints',(_req,res) => {
  const bySku = new Map();
  for (const v of db.prepare('SELECT * FROM variants ORDER BY sku,size').all()) {
    if (!bySku.has(v.sku)) bySku.set(v.sku,{sku:v.sku,title:v.title,image:v.image,sizes:[]});
    bySku.get(v.sku).sizes.push(v);
  }
  res.json({prints:[...bySku.values()].map(p => ({...p,
    from_price_pence:Math.min(...p.sizes.map(s=>s.price_pence)),buyable:p.sizes.some(s=>s.in_stock>0),
    paper_sheets:[...new Set(p.sizes.map(s=>s.stock_sheet))],available_sizes:p.sizes.map(s=>s.size)
  })),postage_bands:pricing.allBands(db),size_weights:pricing.allWeights(db)});
});
app.get('/api/prints/:sku',(req,res) => {
  const sizes = db.prepare('SELECT * FROM variants WHERE sku=? ORDER BY size').all(req.params.sku.toUpperCase());
  if (!sizes.length) return res.status(404).json({error:'Print not found.'});
  res.json({sku:sizes[0].sku,title:sizes[0].title,image:sizes[0].image,sizes});
});
app.post('/api/basket/price',(req,res) => res.json(pricing.computeBasket(req.body?.lines,db)));

function orderView(reference) {
  const order = db.prepare('SELECT * FROM orders WHERE reference=?').get(reference);
  if (!order) return null;
  const {checkout_id,request_hash,...publicOrder} = order;
  return {...publicOrder,collection_only:!!order.collection_only,cancellable:order.status==='placed',
    lines:db.prepare('SELECT * FROM order_lines WHERE order_reference=? ORDER BY id').all(reference)};
}
function cleanAddress(raw) {
  const address = {};
  for (const key of ['name','line1','line2','city','postcode','country']) {
    const value = typeof raw?.[key]==='string' ? raw[key].trim() : '';
    if ((!value && key!=='line2') || value.length>200) throw pricing.fault('Please complete the delivery address.','INVALID_ADDRESS');
    address[key] = value;
  }
  return address;
}
const placeOrder = db.transaction(body => {
  const lines = pricing.normalizeLines(body.lines);
  if (!lines.length) throw pricing.fault('Your basket is empty.','EMPTY_BASKET');
  const address = cleanAddress(body.address);
  const checkoutId = body.checkout_id;
  if (typeof checkoutId!=='string' || checkoutId.length<8 || checkoutId.length>200) {
    throw pricing.fault('Start a new checkout from your basket.','INVALID_CHECKOUT');
  }
  const hash = crypto.createHash('sha256').update(JSON.stringify({lines,address})).digest('hex');
  const previous = db.prepare('SELECT reference,request_hash FROM orders WHERE checkout_id=?').get(checkoutId);
  if (previous) {
    if (previous.request_hash!==hash) throw pricing.fault('That checkout already belongs to a different order. Start a new checkout.','CHECKOUT_CONFLICT');
    return {created:false,order:orderView(previous.reference)};
  }
  const basket = pricing.computeBasket(lines,db,false);
  const order = {
    reference:'RP-'+crypto.randomBytes(5).toString('hex').toUpperCase(),placed_at:new Date().toISOString(),
    status:'placed',checkout_id:checkoutId,request_hash:hash,
    ...Object.fromEntries(Object.entries(address).map(([k,v])=>['address_'+k,v])),
    subtotal_pence:basket.subtotal_pence,trade_saving_pence:basket.trade_saving_pence,
    weight_grams:basket.weight_grams,postage_band:basket.postage.band,postage_pence:basket.postage.price_pence,
    collection_only:Number(basket.postage.collection_only),total_pence:basket.total_pence,lines:basket.lines
  };
  dbmod.insertOrder(db,order);
  const deduct = db.prepare('UPDATE variants SET in_stock=in_stock-? WHERE sku=? AND size=? AND in_stock>=?');
  for (const l of basket.lines) {
    if (deduct.run(l.qty,l.sku,l.size,l.qty).changes!==1) throw pricing.fault('Stock changed. Please review your basket.','INSUFFICIENT_STOCK');
  }
  return {created:true,order:orderView(order.reference)};
});
app.post('/api/orders',(req,res) => {
  const result = placeOrder.immediate(req.body||{});
  res.status(result.created?201:200).json(result.order);
});
app.get('/api/orders/:reference',(req,res) => {
  const order = orderView(req.params.reference.trim().toUpperCase());
  if (!order) return res.status(404).json({error:'No order with that reference.'});
  res.json(order);
});
const cancelOrder = db.transaction(reference => {
  const order = orderView(reference);
  if (!order) throw Object.assign(pricing.fault('No order with that reference.','NOT_FOUND'),{status:404});
  if (order.status==='cancelled') return order;
  if (order.status!=='placed') throw pricing.fault('This order has already been dispatched and cannot be cancelled.','ALREADY_DISPATCHED');
  db.prepare("UPDATE orders SET status='cancelled',cancelled_at=? WHERE reference=?").run(new Date().toISOString(),reference);
  const restore = db.prepare('UPDATE variants SET in_stock=in_stock+? WHERE sku=? AND size=?');
  for (const l of order.lines) restore.run(l.qty,l.sku,l.size);
  return orderView(reference);
});
app.post('/api/orders/:reference/cancel',(req,res) => res.json(cancelOrder.immediate(req.params.reference.trim().toUpperCase())));
app.use('/api',(_req,res) => res.status(404).json({error:'No such endpoint.'}));
app.get('/{*path}',(_req,res) => res.sendFile(path.join(publicDir,'index.html')));
app.use((err,_req,res,_next) => {
  if (err.code && err.detail) return res.status(err.status||409).json({error:err.message,code:err.code,...err.detail});
  if (err.type==='entity.parse.failed') return res.status(400).json({error:'The request body is not valid JSON.'});
  console.error(err);
  res.status(500).json({error:'Could not complete the request. Please try again.'});
});
app.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('Ridgeline Press listening on port '+(process.env.PORT||3000)));
