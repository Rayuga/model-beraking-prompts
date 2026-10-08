'use strict';
const {execFileSync} = require('node:child_process');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

if (process.env.ROW20_CHILD === '1') {
  const RealDate = Date;
  global.Date = class extends RealDate {
    constructor(...args) { super(...(args.length ? args : [process.env.ROW20_CLOCK])); }
    static now() { return RealDate.parse(process.env.ROW20_CLOCK); }
  };
  crypto.randomBytes = () => { throw new Error('Seed requested random bytes'); };
  Math.random = () => { throw new Error('Seed requested random number'); };
  const D = require('/frozen/src/db.js');
  const R = require('/frozen/src/rules.js');
  let db = D.open();
  // Execute the real change-set table initializer; registration does not invoke routes.
  require('/frozen/src/change-sets.js')({app:{get(){},post(){}},db,R,auth(){return () => {};}});
  const rows = () => Object.fromEntries(db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(({name}) => [name,db.prepare('SELECT * FROM "' + name + '" ORDER BY rowid').all()]));
  const first = rows();
  D.seedIfEmpty(db);
  assert.deepEqual(rows(),first,'Second seeding changed initial rows');
  db.close();
  db = D.open();
  assert.deepEqual(rows(),first,'Reopening changed initial rows');
  const derived = {
    compositions:first.offers.map(o => ({id:o.id,...R.composition(o)})),
    headrooms:first.requisitions.map(r => R.headroom(db,r.id)),
    referrals:first.referral_accruals.map(r => ({id:r.id,...R.referralVested(r,R.refAt(db))})),
    signing:first.offers.map(o => ({id:o.id,...R.signingClawback(o,R.refAt(db))})),
    equity:first.equity_grants.map(g => ({id:g.id,...R.equityCancellation(g,R.refAt(db))}))
  };
  const brokenWallClock = first.referral_accruals.map(r => ({id:r.id,...R.referralVested(r,new Date().toISOString())}));
  db.close();
  console.log(JSON.stringify({rows:first,derived,brokenWallClock,simulatedClock:new Date().toISOString(),timezone:process.env.TZ,repeatAndReopenEqual:true}));
} else {
  const cases = [
    {ROW20_CLOCK:'1999-01-01T00:00:00Z',TZ:'Pacific/Kiritimati',DB_PATH:'/tmp/first/app.db'},
    {ROW20_CLOCK:'2041-12-31T23:59:59Z',TZ:'America/Adak',DB_PATH:'/tmp/second/app.db'}
  ];
  const outputs = cases.map(c => JSON.parse(execFileSync(process.execPath,[__filename],{encoding:'utf8',env:{...process.env,...c,ROW20_CHILD:'1'}})));
  assert.deepEqual(outputs[0].rows,outputs[1].rows,'Independent fresh databases differ');
  assert.deepEqual(outputs[0].derived,outputs[1].derived,'Pinned figures depend on wall clock/timezone');
  assert.notDeepEqual(outputs[0].brokenWallClock,outputs[1].brokenWallClock,'Broken wall-clock control was not detected');
  const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
  console.log(JSON.stringify({
    scope:'Local actual SQLite seed/rule execution, independent of full app judging or model grades',
    cases:outputs.map(o => ({simulatedClock:o.simulatedClock,timezone:o.timezone,rowsSha256:digest(o.rows),derivedSha256:digest(o.derived),repeatAndReopenEqual:o.repeatAndReopenEqual,brokenWallClock:o.brokenWallClock})),
    rowsEqual:true,derivedEqual:true,brokenWallClockDetected:true,
    rowCounts:Object.fromEntries(Object.entries(outputs[0].rows).map(([k,v])=>[k,v.length])),
    storedClock:outputs[0].rows.system_clock,
    derived:outputs[0].derived
  },null,2));
}
