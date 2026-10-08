'use strict';
// Read-only pure-rule probe. It neither launches the app nor grades it.
const fs = require('fs');
const vm = require('vm');
const crypto = require('crypto');
const assert = require('assert/strict');
const root = '.qc-cache/hireops-2026-10-01-transaction-hardening-r2/task/';
const rulesFile = root + 'solution/app/src/rules.js';
const seedFile = root + 'environment/assets/seed_data.json';
const seed = JSON.parse(fs.readFileSync(seedFile, 'utf8'));
class NoWallClockDate extends Date {
  constructor(...args) {
    if (!args.length) throw new Error('Unexpected wall-clock read');
    super(...args);
  }
  static now() { throw new Error('Unexpected Date.now read'); }
}
const context = {
  module: {exports: {}}, Date: NoWallClockDate,
  require(id) {
    assert.equal(id, './db');
    return {reference: seed};
  }
};
vm.runInNewContext(fs.readFileSync(rulesFile, 'utf8'), context, {filename: rulesFile});
const R = context.module.exports;
const starts = ['2026-02-01T00:00:00Z', '2026-02-01T00:00:00.001Z', '2026-01-31T12:00:00Z', '2026-09-15T00:00:00Z'];
const rows = starts.map(referred_hire_start => ({referred_hire_start, total_cents: 1000000, at_hire_cents: 500000, contingent_cents: 500000}));
const fixed = rows.map(row => R.referralVested(row, seed.reference_moment));
assert.deepEqual(fixed.map(x => x.vested_cents), [1000000,500000,1000000,500000]);
const wrongRunDate = rows.map(row => R.referralVested(row, '2026-10-01T00:00:00Z').vested_cents);
assert.equal(wrongRunDate[1], 1000000);
assert.notEqual(wrongRunDate[1], fixed[1].vested_cents);
const start = '2024-02-29T12:34:56.789Z';
const before = R.completedMonths(start, '2025-02-28T12:34:56.788Z');
const at = R.completedMonths(start, '2025-02-28T12:34:56.789Z');
assert.equal(before, 11);
assert.equal(at, 12);
const s = R.signingClawback({start_date: start, signing_bonus_cents: 10001}, '2025-02-28T12:34:56.789Z');
assert.equal(s.signing_vested_cents, 4000);
assert.equal(R.completedMonths('2024-01-31T12:00:00Z', '2025-03-30T12:00:00Z'),13);
console.log(JSON.stringify({
  kind: 'Pure frozen-rule execution; no app/browser/provider judge or private checker run',
  command: 'node qc/runs/hireops-2026-10-01-transaction-hardening-r2/per-row-review/evidence/47/clock-probe.cjs',
  input_sha256: '7e8adb4257e0b520304b0c4c7b2d16e184c9f951d54e3b3e77345643d59023f0',
  source_sha256: Object.fromEntries([rulesFile,seedFile].map(p => [p,crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')])),
  wall_clock_reads_forbidden: true,
  fixed_reference: seed.reference_moment,
  referral_results: fixed,
  broken_run_date_simulation: {at: '2026-10-01T00:00:00Z', vested_cents: wrongRunDate, contradicts_fixed_boundary: true},
  leap_boundary_completed_months: {before,at},
  signing_retained_at_boundary: s.signing_vested_cents,
  passed: true
},null,2));
