const express = require('express');
const crypto = require('crypto');
const path = require('path');
const { randomUUID } = require('crypto');
const Stripe = require('stripe');
const { DateTime } = require('luxon');
const ical = require('ical-generator').default;
const { sql, initialize } = require('./db');

const app = express();
if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is required');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const PORT = Number(process.env.PORT || 3000);
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const VENDOR = process.env.VENDOR_BASE_URL || 'http://localhost:3101';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ACTIVE = ['PAID','CHECKED_OUT','AWAITING_INSPECTION','AWAITING_DECISION'];

app.use(express.json({limit:'200kb'}));
app.use(express.static(path.join(__dirname,'public')));
app.get('/downloads/hire-waiver.pdf', (req,res)=>res.download(path.join(__dirname,'assets/hire_waiver.pdf'),'GearVault-hire-waiver.pdf'));

class HttpError extends Error { constructor(status,message){ super(message); this.status=status; } }
const cleanPerson = p => ({id:p.id,email:p.email,full_name:p.full_name,role:p.role,account_status:p.account_status,outstanding_balance_cents:p.outstanding_balance_cents,member:p.member});
async function identity(req,res,next){
  try {
    const id=req.get('X-Demo-User');
    if(!id) throw new HttpError(401,'Choose who is using GearVault before continuing.');
    const [person]=await sql`SELECT * FROM people WHERE id=${id}`;
    if(!person) throw new HttpError(401,'That person is not a GearVault demo user.');
    req.person=person; next();
  } catch(e){ next(e); }
}
app.use('/api',identity);
const requireRole=(...roles)=>(req,res,next)=>roles.includes(req.person.role)?next():next(new HttpError(403,'Your current role cannot do that job.'));
function dates(start,end){
  if(!DATE_RE.test(start||'')||!DATE_RE.test(end||'')) throw new HttpError(400,'Use calendar dates in YYYY-MM-DD format.');
  const a=DateTime.fromISO(start,{zone:'utc'}), b=DateTime.fromISO(end,{zone:'utc'});
  if(!a.isValid||!b.isValid||a.toISODate()!==start||b.toISODate()!==end) throw new HttpError(400,'Enter valid calendar dates.');
  const days=Math.floor(b.diff(a,'days').days)+1;
  if(days<1) throw new HttpError(400,'The return day cannot be before the start day.');
  if(days>14) throw new HttpError(400,'One rental can cover at most 14 calendar days.');
  if(a < DateTime.utc().startOf('day')) throw new HttpError(400,'The start day must not be in the past.');
  return {days,a,b};
}
async function vendor(route,{method='GET',body,query,notice=false,headers:extraHeaders={}}={}){
  const url=new URL(route,VENDOR); if(query) Object.entries(query).forEach(([k,v])=>url.searchParams.set(k,v));
  const headers={'Authorization':`Bearer ${process.env.VENDOR_TOKEN||''}`,'Content-Type':'application/json',...extraHeaders};
  if(notice) headers['X-Notice-Key']=process.env.NOTICE_API_KEY||'';
  const response=await fetch(url,{method,headers,body:body?JSON.stringify(body):undefined});
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new HttpError(422,data.error||'A shop-network desk declined the request.');
  return data;
}
function hashRequest(req){return crypto.createHash('sha256').update(JSON.stringify({method:req.method,path:req.path,body:req.body})).digest('hex');}
function mutation(handler){ return async(req,res,next)=>{
  try {
    const key=req.get('Idempotency-Key'); if(!key||key.length<8||key.length>120) throw new HttpError(400,'This action needs a valid request ticket. Please try again.');
    const hash=hashRequest(req); const [old]=await sql`SELECT * FROM idempotency_receipts WHERE actor_id=${req.person.id} AND ticket_key=${key}`;
    if(old){ if(old.request_hash!==hash) throw new HttpError(409,'That request ticket was already used for a different action.'); return res.status(old.status_code).json(old.response); }
    const answer=await handler(req); const status=answer.status||200; const payload=answer.body||answer;
    await sql`INSERT INTO idempotency_receipts (actor_id,ticket_key,request_hash,status_code,response) VALUES (${req.person.id},${key},${hash},${status},${sql.json(payload)})`;
    res.status(status).json(payload);
  }catch(e){next(e);}
};}
async function audit(tx,actor,action,type,id,before,after){await tx`INSERT INTO audit_log (actor_id,action,entity_type,entity_id,before_state,after_state) VALUES (${actor},${action},${type},${String(id)},${before?tx.json(before):null},${after?tx.json(after):null})`;}

app.get('/api/health',async(req,res)=>{const [db]=await sql`SELECT current_database() db`;let network=false;try{network=(await vendor('/health')).ok}catch{}res.json({ok:true,database:db.db,storage:'Postgres',vendor_network:network});});
app.get('/api/people',async(req,res)=>res.json({people:(await sql`SELECT * FROM people ORDER BY role='customer' DESC,full_name`).map(cleanPerson)}));
app.get('/api/overview',async(req,res)=>{
 const units=await sql`SELECT u.*,l.name location_name,l.slug location_slug FROM units u JOIN locations l ON l.id=u.location_id ORDER BY u.asset_tag`;
 const locations=await sql`SELECT * FROM locations ORDER BY name`;
 res.json({me:cleanPerson(req.person),units,locations});
});
app.get('/api/me/records',async(req,res)=>{
 if(req.person.role!=='customer') throw new HttpError(403,'Customer records are only available to customers.');
 const reservations=await sql`SELECT r.*,u.asset_tag,u.category,u.model,l.name location_name FROM reservations r JOIN units u ON u.id=r.unit_id JOIN locations l ON l.id=u.location_id WHERE r.customer_id=${req.person.id} ORDER BY r.paid_at DESC`;
 const certifications=await sql`SELECT * FROM certifications WHERE customer_id=${req.person.id} ORDER BY expires_on DESC`;
 let noticeData={},textData={},emailData={},holdData={},punchData={},bindData={};
 try{[noticeData,textData,emailData,holdData,punchData,bindData]=await Promise.all(['/notices/receipts','/sms/receipts','/email/receipts','/calendar/holds','/loyalty/punches','/insurance/binds'].map(r=>vendor(r,{notice:r!='/insurance/binds'})));}catch{}
 const own=new Set(reservations.map(r=>r.id)); const mine=items=>(items||[]).filter(i=>own.has(i.reservation_id));
 res.json({reservations,certifications,notices:mine(noticeData.receipts),texts:mine(textData.receipts),emails:mine(emailData.receipts),holds:mine(holdData.holds),punches:mine(punchData.punches),binds:mine(bindData.binds)});
});

async function buildQuote(customer,unitId,start,end){
 const {days}=dates(start,end); if(customer.account_status!=='ACTIVE'||customer.outstanding_balance_cents>0) throw new HttpError(422,'This account is on hold until its outstanding balance is resolved.');
 const [unit]=await sql`SELECT u.*,l.slug location_slug,l.name location_name FROM units u JOIN locations l ON l.id=u.location_id WHERE u.id=${unitId}`;
 if(!unit) throw new HttpError(404,'That serialized unit was not found.');
 if(['IN_REPAIR','RETIRED','CHECKED_OUT','AWAITING_INSPECTION'].includes(unit.status)) throw new HttpError(422,'This unit is not currently available to reserve.');
 const [overlap]=await sql`SELECT id FROM reservations WHERE unit_id=${unit.id} AND status IN ${sql(ACTIVE)} AND daterange(start_date,end_date,'[]') && daterange(${start}::date,${end}::date,'[]')`;
 if(overlap) throw new HttpError(409,'This unit is already reserved for part of those dates.');
 if(unit.required_certification){const [cert]=await sql`SELECT * FROM certifications WHERE customer_id=${customer.id} AND certification_type=${unit.required_certification} AND expires_on >= ${end}::date`;if(!cert) throw new HttpError(422,`A current ${unit.required_certification} card through the return day is required.`);}
 const base=unit.daily_rate_cents*days, discount=days>=7?Math.round(base*.1):0, rental=base-discount;
 const [weekend,weather,blackout,hull]=await Promise.all([
  vendor('/surcharge/weekend',{query:{start,end}}), vendor('/weather/forecast',{query:{start,end}}),
  vendor('/blackout/calendar',{query:{start,end}}), vendor('/insurance/hull',{method:'POST',body:{category:unit.category,day_count:days}})
 ]);
 if(!blackout.shop_open) throw new HttpError(422,`The shop is closed during this range${blackout.closed_dates?.length?`: ${blackout.closed_dates.join(', ')}`:''}.`);
 if(['Tent','Generator','Rain Fly'].includes(unit.category)&&(!weather.outdoor_ok||weather.canvas_hold)) throw new HttpError(422,'The weather desk has placed an outdoor canvas hold on these dates.');
 const weekendCents=weekend.surcharge_cents||0;
 const tax=await vendor('/tax/quote',{query:{shop:unit.location_slug,rental_cents:rental+weekendCents}});
 const hullCents=hull.premium_cents||0,total=rental+weekendCents+tax.tax_cents+hullCents+unit.deposit_cents;
 return {unit,start_date:start,end_date:end,day_count:days,base_cents:base,discount_cents:discount,rental_cents:rental,weekend_cents:weekendCents,tax_cents:tax.tax_cents,hull_cents:hullCents,deposit_cents:unit.deposit_cents,total_cents:total,vendor_snapshot:{weekend,weather,blackout,hull,tax}};
}
app.post('/api/quotes',requireRole('customer'),mutation(async req=>{
 const q=await buildQuote(req.person,req.body.unit_id,req.body.start_date,req.body.end_date); return {quote:q};
}));
app.post('/api/checkout',requireRole('customer'),mutation(async req=>{
 const q=await buildQuote(req.person,req.body.unit_id,req.body.start_date,req.body.end_date); const id=randomUUID();
 const line_items=[
  {price_data:{currency:'usd',product_data:{name:`${q.unit.asset_tag} · ${q.unit.model}`,description:`${q.day_count} day hire, ${q.start_date} – ${q.end_date}`},unit_amount:q.rental_cents},quantity:1},
  ...(q.weekend_cents?[{price_data:{currency:'usd',product_data:{name:'Weekend surcharge'},unit_amount:q.weekend_cents},quantity:1}]:[]),
  ...(q.tax_cents?[{price_data:{currency:'usd',product_data:{name:`${q.unit.location_name} county tax`},unit_amount:q.tax_cents},quantity:1}]:[]),
  ...(q.hull_cents?[{price_data:{currency:'usd',product_data:{name:'Drone hull insurance'},unit_amount:q.hull_cents},quantity:1}]:[]),
  {price_data:{currency:'usd',product_data:{name:'Refundable equipment deposit'},unit_amount:q.deposit_cents},quantity:1}
 ];
 const session=await stripe.checkout.sessions.create({mode:'payment',customer_email:req.person.email,line_items,success_url:`${BASE_URL}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,cancel_url:`${BASE_URL}/?checkout=cancelled`,metadata:{quote_id:id,customer_id:req.person.id,unit_id:q.unit.id}});
 await sql`INSERT INTO checkout_quotes ${sql({id,customer_id:req.person.id,unit_id:q.unit.id,start_date:q.start_date,end_date:q.end_date,day_count:q.day_count,base_cents:q.base_cents,discount_cents:q.discount_cents,rental_cents:q.rental_cents,weekend_cents:q.weekend_cents,tax_cents:q.tax_cents,hull_cents:q.hull_cents,deposit_cents:q.deposit_cents,total_cents:q.total_cents,vendor_snapshot:sql.json(q.vendor_snapshot),stripe_session_id:session.id,stripe_url:session.url,status:'OPEN'})}`;
 return {status:201,body:{checkout_url:session.url,session_id:session.id}};
}));
async function postPaidCopies(r,person,unit){
 const receipt={reservation_id:r.id,customer_id:person.id,unit_id:unit.id,asset_tag:unit.asset_tag,start_date:r.start_date,end_date:r.end_date,rental_cents:r.rental_cents,weekend_cents:r.weekend_cents,tax_cents:r.tax_cents,hull_cents:r.hull_cents,deposit_cents:r.deposit_cents,total_cents:r.total_cents};
 await Promise.all(['/notices/receipts','/sms/receipts','/email/receipts'].map(route=>vendor(route,{method:'POST',notice:true,body:receipt})));
 await vendor('/calendar/holds',{method:'POST',notice:true,body:{...receipt}});
 if(person.member) await vendor('/loyalty/punches',{method:'POST',notice:true,body:{reservation_id:r.id,customer_id:person.id}});
 if(r.hull_cents){const signature=crypto.createHmac('sha256',process.env.INSURANCE_HMAC_SECRET||'').update(r.stripe_session_id).digest('hex');await vendor('/insurance/bind',{method:'POST',body:{session_id:r.stripe_session_id,sessionId:r.stripe_session_id,customer_id:person.id,unit_id:unit.id},query:{},headers:{'x-insurance-signature':signature}}).catch(()=>{});}
}
app.post('/api/payments/confirm',requireRole('customer'),mutation(async req=>{
 const session=await stripe.checkout.sessions.retrieve(req.body.session_id); if(session.payment_status!=='paid') throw new HttpError(422,'Stripe has not confirmed payment for this checkout.');
 if(session.metadata.customer_id!==req.person.id) throw new HttpError(403,'This checkout belongs to another customer.');
 const [existing]=await sql`SELECT * FROM reservations WHERE stripe_session_id=${session.id}`; if(existing)return {reservation:existing};
 const [quote]=await sql`SELECT * FROM checkout_quotes WHERE id=${session.metadata.quote_id} AND customer_id=${req.person.id}`; if(!quote)throw new HttpError(404,'The paid quote was not found.');
 if(session.amount_total!==quote.total_cents)throw new HttpError(409,'The Stripe total does not match the shop ledger.');
 const id=randomUUID(); let reservation;
 await sql.begin(async tx=>{const [unit]=await tx`SELECT * FROM units WHERE id=${quote.unit_id} FOR UPDATE`; if(!unit||['IN_REPAIR','RETIRED'].includes(unit.status))throw new HttpError(409,'This unit can no longer be reserved.'); [reservation]=await tx`INSERT INTO reservations ${tx({id,customer_id:req.person.id,unit_id:quote.unit_id,quote_id:quote.id,start_date:quote.start_date,end_date:quote.end_date,day_count:quote.day_count,base_cents:quote.base_cents,discount_cents:quote.discount_cents,rental_cents:quote.rental_cents,weekend_cents:quote.weekend_cents,tax_cents:quote.tax_cents,hull_cents:quote.hull_cents,deposit_cents:quote.deposit_cents,total_cents:quote.total_cents,status:'PAID',stripe_session_id:session.id,stripe_payment_intent_id:String(session.payment_intent||''),paid_at:new Date()})} RETURNING *`;await tx`UPDATE checkout_quotes SET status='PAID' WHERE id=${quote.id}`;await tx`UPDATE units SET status='RESERVED' WHERE id=${quote.unit_id}`;await audit(tx,req.person.id,'PAYMENT_CONFIRMED','reservation',id,null,reservation);});
 const [unit]=await sql`SELECT * FROM units WHERE id=${quote.unit_id}`; await postPaidCopies(reservation,req.person,unit); return {status:201,body:{reservation,message:'Payment confirmed. Your dates are held.'}};
}));
app.get('/api/operations',requireRole('rental_associate','bay_technician','damage_assessor','shop_manager','transfer_clerk','night_auditor','insurance_liaison','lot_runner'),async(req,res)=>{
 const reservations=await sql`SELECT r.*,u.asset_tag,u.category,u.model,u.location_id,l.name location_name,p.full_name customer_name FROM reservations r JOIN units u ON u.id=r.unit_id JOIN locations l ON l.id=u.location_id JOIN people p ON p.id=r.customer_id ORDER BY r.paid_at DESC`;
 const inspections=await sql`SELECT i.*,r.unit_id,u.asset_tag,u.model,p.full_name customer_name,a.full_name assessor_name FROM inspections i JOIN reservations r ON r.id=i.reservation_id JOIN units u ON u.id=r.unit_id JOIN people p ON p.id=r.customer_id JOIN people a ON a.id=i.assessor_id ORDER BY i.created_at DESC`;
 const units=await sql`SELECT u.*,l.name location_name,l.slug location_slug FROM units u JOIN locations l ON l.id=u.location_id ORDER BY asset_tag`;
 const locations=await sql`SELECT * FROM locations ORDER BY name`;
 const payload={reservations,inspections,units,locations};
 if(['shop_manager','night_auditor'].includes(req.person.role)) payload.audit=await sql`SELECT a.*,p.full_name actor_name FROM audit_log a JOIN people p ON p.id=a.actor_id ORDER BY a.created_at DESC LIMIT 200`;
 if(req.person.role==='shop_manager') payload.customers=(await sql`SELECT * FROM people WHERE role='customer' ORDER BY full_name`).map(cleanPerson);
 if(req.person.role==='insurance_liaison'){try{payload.binds=(await vendor('/insurance/binds')).binds||[]}catch{payload.binds=[]}}
 res.json(payload);
});
app.post('/api/reservations/:id/cancel',requireRole('customer'),mutation(async req=>{
 let after; await sql.begin(async tx=>{const [r]=await tx`SELECT * FROM reservations WHERE id=${req.params.id} AND customer_id=${req.person.id} FOR UPDATE`;if(!r)throw new HttpError(404,'That reservation was not found in your account.');if(r.status!=='PAID')throw new HttpError(422,'Only a paid rental still on the shelf can be cancelled.');[after]=await tx`UPDATE reservations SET status='CANCELLED',cancelled_at=now() WHERE id=${r.id} RETURNING *`;const [other]=await tx`SELECT id FROM reservations WHERE unit_id=${r.unit_id} AND id<>${r.id} AND status IN ${tx(ACTIVE)} LIMIT 1`;await tx`UPDATE units SET status=${other?'RESERVED':'AVAILABLE'} WHERE id=${r.unit_id}`;await audit(tx,req.person.id,'RESERVATION_CANCELLED','reservation',r.id,r,after);});return {reservation:after,message:'Reservation cancelled. The full deposit is marked for return.'};
}));
app.post('/api/reservations/:id/scan',requireRole('bay_technician'),mutation(async req=>{
 const [r]=await sql`SELECT r.*,u.asset_tag FROM reservations r JOIN units u ON u.id=r.unit_id WHERE r.id=${req.params.id}`;if(!r||r.status!=='PAID')throw new HttpError(422,'A live scan can only be issued for a paid booking on the shelf.');
 const fleet=await vendor('/fleet/serials',{query:{asset_tag:r.asset_tag}}); const ticket=await vendor('/scan/tickets',{method:'POST',body:{reservation_id:r.id,unit_id:r.unit_id,bay_code:fleet.bay_code,bayCode:fleet.bay_code}});
 const id=randomUUID(),ticketId=ticket.ticket_id||ticket.id; await sql`INSERT INTO serial_scans ${sql({id,reservation_id:r.id,unit_id:r.unit_id,technician_id:req.person.id,bay_code:fleet.bay_code,vendor_ticket_id:ticketId,used:false})}`;return {scan:{id,ticket_id:ticketId,bay_code:fleet.bay_code},message:'Bay code confirmed and live serial scan issued.'};
}));
app.post('/api/reservations/:id/checkout',requireRole('rental_associate'),mutation(async req=>{
 let after;await sql.begin(async tx=>{const [r]=await tx`SELECT * FROM reservations WHERE id=${req.params.id} FOR UPDATE`;if(!r||r.status!=='PAID')throw new HttpError(422,'This booking is not ready for checkout.');const [unit]=await tx`SELECT * FROM units WHERE id=${r.unit_id} FOR UPDATE`;if(unit.status!=='RESERVED')throw new HttpError(422,'The unit is no longer ready at the named shop.');if(unit.required_certification){const [cert]=await tx`SELECT id FROM certifications WHERE customer_id=${r.customer_id} AND certification_type=${unit.required_certification} AND expires_on>=CURRENT_DATE`;if(!cert)throw new HttpError(422,`The customer needs a current ${unit.required_certification} card at pickup.`);}const [scan]=await tx`SELECT * FROM serial_scans WHERE reservation_id=${r.id} AND unit_id=${r.unit_id} AND used=false ORDER BY created_at DESC LIMIT 1 FOR UPDATE`;if(!scan)throw new HttpError(422,'Omar must issue a live serial scan before this kit can leave.');await vendor('/scan/redeem',{method:'POST',body:{ticketId:scan.vendor_ticket_id,reservation_id:r.id,unit_id:r.unit_id}});[after]=await tx`UPDATE reservations SET status='CHECKED_OUT',checked_out_at=now() WHERE id=${r.id} RETURNING *`;await tx`UPDATE serial_scans SET used=true WHERE id=${scan.id}`;await tx`UPDATE units SET status='CHECKED_OUT' WHERE id=${r.unit_id}`;await audit(tx,req.person.id,'UNIT_CHECKED_OUT','reservation',r.id,r,after);});return {reservation:after,message:'Serial scan redeemed. Kit checked out.'};
}));
app.post('/api/reservations/:id/return',requireRole('rental_associate'),mutation(async req=>{
 let after;await sql.begin(async tx=>{const [r]=await tx`SELECT * FROM reservations WHERE id=${req.params.id} FOR UPDATE`;if(!r||r.status!=='CHECKED_OUT')throw new HttpError(422,'Only kit currently checked out can be returned.');[after]=await tx`UPDATE reservations SET status='AWAITING_INSPECTION',returned_at=now() WHERE id=${r.id} RETURNING *`;await tx`UPDATE units SET status='AWAITING_INSPECTION' WHERE id=${r.unit_id}`;await audit(tx,req.person.id,'UNIT_RETURNED','reservation',r.id,r,after);});return {reservation:after,message:'Return received. The kit is held in the inspection corner.'};
}));
app.post('/api/reservations/:id/inspect',requireRole('damage_assessor'),mutation(async req=>{
 const outcome=String(req.body.outcome||'').toUpperCase();if(!['CLEAR','DAMAGE'].includes(outcome))throw new HttpError(400,'Choose clear or damage.');const proposed=Number(req.body.proposed_cents||0);if(!Number.isInteger(proposed)||proposed<0)throw new HttpError(400,'Enter a valid proposed deduction.');
 let inspection;await sql.begin(async tx=>{const [r]=await tx`SELECT * FROM reservations WHERE id=${req.params.id} FOR UPDATE`;if(!r||r.status!=='AWAITING_INSPECTION')throw new HttpError(422,'This return is not waiting for inspection.');if(proposed>Math.min(r.deposit_cents,(await tx`SELECT replacement_value_cents FROM units WHERE id=${r.unit_id}`)[0].replacement_value_cents))throw new HttpError(422,'The proposal cannot exceed the deposit or replacement value.');let photo=null;if(outcome==='DAMAGE'){const t=await vendor('/media/tickets',{method:'POST',notice:true,body:{reservation_id:r.id}});photo=t.ticket_id||t.id;if(!photo)throw new HttpError(422,'The photo desk did not issue a damage ticket.');}const id=randomUUID();[inspection]=await tx`INSERT INTO inspections ${tx({id,reservation_id:r.id,assessor_id:req.person.id,outcome,severity:outcome==='DAMAGE'?String(req.body.severity||'MINOR').toUpperCase():null,notes:String(req.body.notes||''),proposed_cents:outcome==='DAMAGE'?proposed:0,photo_ticket_id:photo,status:outcome==='DAMAGE'?'PENDING':'APPROVED'})} RETURNING *`;if(outcome==='CLEAR'){await tx`UPDATE reservations SET status='COMPLETED',completed_at=now() WHERE id=${r.id}`;await tx`UPDATE units SET status='AVAILABLE' WHERE id=${r.unit_id}`;}else await tx`UPDATE reservations SET status='AWAITING_DECISION' WHERE id=${r.id}`;await audit(tx,req.person.id,outcome==='CLEAR'?'INSPECTION_CLEARED':'DAMAGE_FILED','inspection',id,null,inspection);});return {inspection,message:outcome==='CLEAR'?'Inspection cleared; kit returned to the floor.':'Damage filed for manager review.'};
}));
app.post('/api/inspections/:id/approve',requireRole('shop_manager'),mutation(async req=>{
 const approved=Number(req.body.approved_cents);if(!Number.isInteger(approved)||approved<0)throw new HttpError(400,'Enter a valid approved deduction.');let inspection;await sql.begin(async tx=>{const [i]=await tx`SELECT * FROM inspections WHERE id=${req.params.id} FOR UPDATE`;if(!i||i.status!=='PENDING')throw new HttpError(422,'This write-up is not awaiting a decision.');const [r]=await tx`SELECT * FROM reservations WHERE id=${i.reservation_id} FOR UPDATE`;const [u]=await tx`SELECT * FROM units WHERE id=${r.unit_id} FOR UPDATE`;if(approved>Math.min(r.deposit_cents,u.replacement_value_cents))throw new HttpError(422,'The deduction cannot exceed the deposit or replacement value.');[inspection]=await tx`UPDATE inspections SET status='APPROVED',manager_id=${req.person.id},approved_cents=${approved},decision_notes=${String(req.body.notes||'')},decided_at=now() WHERE id=${i.id} RETURNING *`;await tx`UPDATE reservations SET status='COMPLETED',deposit_deduction_cents=${approved},completed_at=now() WHERE id=${r.id}`;const next=i.severity==='MAJOR'?'IN_REPAIR':'AVAILABLE';await tx`UPDATE units SET status=${next} WHERE id=${u.id}`;if(approved>0)await tx`UPDATE people SET outstanding_balance_cents=GREATEST(outstanding_balance_cents,${approved}),account_status='ON_HOLD' WHERE id=${r.customer_id}`;await audit(tx,req.person.id,'DAMAGE_APPROVED','inspection',i.id,i,inspection);});return {inspection,message:'Damage decision recorded and deposit balance reconciled.'};
}));
app.post('/api/units/:id/transfer',requireRole('transfer_clerk'),mutation(async req=>{
 let transfer;await sql.begin(async tx=>{const [u]=await tx`SELECT u.*,l.slug from_slug FROM units u JOIN locations l ON l.id=u.location_id WHERE u.id=${req.params.id} FOR UPDATE`;const [to]=await tx`SELECT * FROM locations WHERE id=${req.body.to_location_id}`;if(!u||!to)throw new HttpError(404,'Choose a valid unit and destination.');if(u.status!=='AVAILABLE')throw new HttpError(422,'Only genuinely idle floor stock can move between shops.');const [spoken]=await tx`SELECT id FROM reservations WHERE unit_id=${u.id} AND status IN ${tx(ACTIVE)}`;if(spoken)throw new HttpError(422,'This unit is already promised on a paid paper.');const day=DateTime.utc().toISODate();const blackout=await vendor('/blackout/calendar',{query:{start:day,end:day}});if(blackout.van_idle)throw new HttpError(422,'The transfer van is idle on this shop closure day.');const stamp=await vendor('/transfer/stamps',{method:'POST',body:{unit_id:u.id,to_shop:to.slug,from_shop:u.from_slug,clerk_id:req.person.id}});const stampId=stamp.stamp_id||stamp.id;await vendor('/transfer/redeem',{method:'POST',body:{stampId,unit_id:u.id}});const id=randomUUID();[transfer]=await tx`INSERT INTO transfers ${tx({id,unit_id:u.id,from_location_id:u.location_id,to_location_id:to.id,clerk_id:req.person.id,vendor_stamp_id:stampId})} RETURNING *`;await tx`UPDATE units SET location_id=${to.id} WHERE id=${u.id}`;await audit(tx,req.person.id,'UNIT_TRANSFERRED','unit',u.id,u,{...u,location_id:to.id});});return {transfer,message:'Transfer stamp redeemed. Unit location updated.'};
}));
app.post('/api/units/:id/manage',requireRole('shop_manager'),mutation(async req=>{
 const allowed=['AVAILABLE','IN_REPAIR','RETIRED'];const status=req.body.status;let after;await sql.begin(async tx=>{const [u]=await tx`SELECT * FROM units WHERE id=${req.params.id} FOR UPDATE`;if(!u)throw new HttpError(404,'Unit not found.');if(status&&!allowed.includes(status))throw new HttpError(400,'Choose available, in repair, or retired.');if(status==='AVAILABLE'){const [live]=await tx`SELECT id FROM reservations WHERE unit_id=${u.id} AND status IN ${tx(ACTIVE)}`;if(live)throw new HttpError(422,'This unit is still promised or out on a live paper.');}const rate=req.body.daily_rate_cents===undefined?u.daily_rate_cents:Number(req.body.daily_rate_cents),deposit=req.body.deposit_cents===undefined?u.deposit_cents:Number(req.body.deposit_cents);if(!Number.isInteger(rate)||rate<0||!Number.isInteger(deposit)||deposit<0)throw new HttpError(400,'Rates and deposits must be whole pennies.');[after]=await tx`UPDATE units SET status=${status||u.status},daily_rate_cents=${rate},deposit_cents=${deposit} WHERE id=${u.id} RETURNING *`;await audit(tx,req.person.id,'UNIT_MANAGED','unit',u.id,u,after);});return {unit:after,message:'Wall card and unit status updated.'};
}));
app.post('/api/customers/:id/standing',requireRole('shop_manager'),mutation(async req=>{const status=req.body.account_status;if(!['ACTIVE','ON_HOLD'].includes(status))throw new HttpError(400,'Choose active or on hold.');let after;await sql.begin(async tx=>{const [p]=await tx`SELECT * FROM people WHERE id=${req.params.id} AND role='customer' FOR UPDATE`;if(!p)throw new HttpError(404,'Customer not found.');[after]=await tx`UPDATE people SET account_status=${status},outstanding_balance_cents=${status==='ACTIVE'?0:p.outstanding_balance_cents} WHERE id=${p.id} RETURNING *`;await audit(tx,req.person.id,'CUSTOMER_STANDING_CHANGED','person',p.id,p,after);});return {customer:cleanPerson(after),message:'Customer standing updated.'};}));
app.get('/api/reservations/:id/calendar.ics',requireRole('customer'),async(req,res)=>{const [r]=await sql`SELECT r.*,u.asset_tag,u.model,l.name location_name FROM reservations r JOIN units u ON u.id=r.unit_id JOIN locations l ON l.id=u.location_id WHERE r.id=${req.params.id} AND r.customer_id=${req.person.id}`;if(!r)throw new HttpError(404,'Reservation not found.');const cal=ical({name:'GearVault hires'});cal.createEvent({id:r.id,start:DateTime.fromISO(String(r.start_date).slice(0,10),{zone:'utc'}).toJSDate(),end:DateTime.fromISO(String(r.end_date).slice(0,10),{zone:'utc'}).plus({days:1}).toJSDate(),allDay:true,summary:`GearVault · ${r.asset_tag} ${r.model}`,location:r.location_name});res.type('text/calendar').attachment(`GearVault-${r.asset_tag}.ics`).send(cal.toString());});

app.use((err,req,res,next)=>{console.error(err.status?err.message:err);const status=err.status||((err.code==='23P01'||err.code==='23505')?409:500);const message=status===500?'GearVault could not complete that request. Please try again.':(err.code==='23P01'?'Those dates were just reserved by someone else.':err.message);res.status(status).json({error:message});});
initialize().then(()=>app.listen(PORT,'0.0.0.0',()=>console.log(`GearVault listening on ${PORT}; ledger: Postgres`))).catch(e=>{console.error('Startup failed',e);process.exit(1)});
