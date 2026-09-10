import crypto from 'crypto';
import {
  linesForJob,
  postedSnapshot,
  postedLines,
  executedCos,
  ticketsForLine,
  payrollDays,
  insuranceFor,
  foundationStamp,
  subInvoiceCovering,
  lumpAsOf,
  companyById
} from './db.js';
import { datesInRange } from './dates.js';
import { vendorJson } from './vendors.js';

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  throw err;
}

export async function deriveProgress(job, periodStart, periodEnd) {
  const lines = linesForJob(job.id);
  const prev = postedSnapshot(job.id);
  const prevLines = prev ? postedLines(prev.id) : [];
  const prevByLine = new Map(prevLines.map((l) => [l.sov_line_id, l]));
  const cos = executedCos(job.id, periodEnd);
  const coByLine = new Map();
  for (const co of cos) {
    coByLine.set(co.sov_line_id, (coByLine.get(co.sov_line_id) || 0) + co.amount_cents);
  }

  const derived = [];
  for (const line of lines) {
    const prevRow = prevByLine.get(line.id) || {
      billed_to_date_cents: 0,
      stored_remaining_cents: 0
    };
    let billed = prevRow.billed_to_date_cents;
    let stored = 0;
    const tickets = ticketsForLine(line.id).filter((t) => t.ticket_date <= periodEnd);
    if (line.kind === 'unit_price') {
      const installedQty = tickets.filter((t) => t.kind === 'installed').reduce((s, t) => s + t.qty, 0);
      const storedQty = tickets.filter((t) => t.kind === 'stored').reduce((s, t) => s + t.qty, 0);
      billed = installedQty * line.unit_rate_cents;
      stored = storedQty * line.unit_rate_cents;
    } else if (line.gc_line) {
      const months = datesInRange(periodStart, periodEnd).some((d) => d.slice(0, 7) !== 'ignore')
        ? 1
        : 1;
      billed = prevRow.billed_to_date_cents + (job.gc_monthly_draw_cents * months);
    } else {
      const sub = subInvoiceCovering(job.id, line.id, periodStart, periodEnd);
      if (sub) billed = prevRow.billed_to_date_cents + sub.amount_cents;
      else {
        const lump = lumpAsOf(line.id, periodEnd);
        billed = lump ? lump.billed_to_date_cents : prevRow.billed_to_date_cents;
      }
      stored = 0;
    }
    const ceiling = line.original_cents + (coByLine.get(line.id) || 0);
    if (billed > ceiling) {
      httpError(409, `${line.tag} is over its contracted ceiling`);
    }
    if (line.permit_gated) {
      const foundations = lines.find((l) => l.tag === '03-100');
      const foundComplete = Boolean(foundations && (
        (ticketsForLine(foundations.id).filter((t) => t.kind === 'installed' && t.ticket_date <= periodEnd)
          .reduce((s, t) => s + t.qty, 0) * foundations.unit_rate_cents) >= foundations.original_cents
      ));
      // The permit desk owns this rule; the till only reports what it can see.
      await vendorJson('POST', '/permit/gate', {
        body: {
          line_tag: line.tag,
          billed_cents: billed,
          predecessor_complete: foundComplete && Boolean(foundationStamp(job.id))
        }
      });
    }
    const wip = billed - prevRow.billed_to_date_cents;
    if (wip < 0) httpError(409, `${line.tag} cannot unbill a posted snapshot`);
    derived.push({
      line,
      billed_to_date_cents: billed,
      stored_remaining_cents: stored,
      previous_billed_cents: prevRow.billed_to_date_cents,
      previous_stored_cents: prevRow.stored_remaining_cents,
      this_period_wip_cents: wip
    });
  }
  return { derived, prev, cos };
}

export async function composeQuote(job, periodStart, periodEnd) {
  if (periodEnd < '2030-03-01') {
    httpError(409, 'Books are not open before 2030-03-01');
  }
  if (job.stop_work) httpError(409, 'Stop-work is on this job');
  const gc = companyById(job.gc_company_id);
  if (gc?.status === 'ON_HOLD') httpError(409, 'That company is on hold');

  const blackout = await vendorJson('GET', '/blackout/calendar', {
    query: { start: periodStart, end: periodEnd }
  });
  if (blackout.open === false || String(blackout.condition).toUpperCase() === 'CLOSED') {
    httpError(409, 'Fiscal close week — the blackout desk already knew');
  }

  const { derived, prev, cos } = await deriveProgress(job, periodStart, periodEnd);
  const originalSum = derived.reduce((s, d) => s + d.line.original_cents, 0);
  if (originalSum !== job.original_contract_cents) {
    httpError(409, 'Schedule of values does not foot to the original contract');
  }

  let prevStored = 0;
  let currStored = 0;
  let wip = 0;
  let gcThis = 0;
  let dbeWip = 0;
  let steelWip = 0;
  let coFeeBase = 0;
  let newStored = 0;
  let converted = 0;
  for (const d of derived) {
    wip += d.this_period_wip_cents;
    prevStored += d.previous_stored_cents;
    currStored += d.stored_remaining_cents;
    if (d.line.gc_line) gcThis += d.this_period_wip_cents;
    if (d.line.dbe) dbeWip += d.this_period_wip_cents;
    if (d.line.joint_check) steelWip += d.this_period_wip_cents;
    const lineStored = await vendorJson('POST', '/stored/quote', {
      body: {
        previous_stored_cents: d.previous_stored_cents,
        current_stored_cents: d.stored_remaining_cents
      }
    });
    newStored += Number(lineStored.new_stored_cents);
    converted += Number(lineStored.converted_cents);
  }
  const executedCoCents = cos.reduce((s, c) => s + c.amount_cents, 0);
  const mill = cos.find((c) => c.index_item);
  if (mill) {
    const index = await vendorJson('GET', '/index/mill', { query: { item: mill.index_item } });
    if (Number(index.amount_cents) !== mill.amount_cents) {
      httpError(409, 'Mill extra does not match the index desk');
    }
    await vendorJson('POST', '/co/registry', {
      body: { job_id: job.id, period_end: periodEnd, co_id: mill.id }
    });
    coFeeBase = mill.amount_cents;
  }

  const billedToDate = derived.reduce((s, d) => s + d.billed_to_date_cents, 0);
  const completedAndStored = billedToDate + currStored;
  const currentContracted = job.original_contract_cents + executedCoCents;

  const retainage = await vendorJson('POST', '/retainage/quote', {
    body: {
      wip_cents: wip,
      converted_cents: converted,
      gc_this_cents: gcThis,
      new_stored_cents: newStored,
      completed_and_stored_cents: completedAndStored,
      current_contracted_cents: currentContracted
    }
  });

  const feeBaseExGc = wip - gcThis;
  const originalFeeBase = feeBaseExGc - coFeeBase;
  if (originalFeeBase < 0) httpError(409, 'Fee base cannot be negative');
  const fee = await vendorJson('POST', '/fee/quote', {
    body: { original_base_cents: originalFeeBase, co_base_cents: coFeeBase }
  });

  let bondCents = 0;
  const bondAlready = Boolean(prev && (prev.bond_cents || 0) > 0);
  if (!bondAlready) {
    const bond = await vendorJson('POST', '/bond/quote', {
      body: { original_contract_cents: job.original_contract_cents, already_billed: false }
    });
    bondCents = Number(bond.bond_cents);
  }

  const fringe = await vendorJson('POST', '/fringe/quote', {
    body: { job_id: job.id, period_start: periodStart, period_end: periodEnd }
  });

  const weather = await vendorJson('GET', '/weather/days', {
    query: { job_id: job.id, start: periodStart, end: periodEnd }
  });
  const ld = await vendorJson('POST', '/ld/quote', {
    body: { scd: job.scd, period_end: periodEnd, weather_days: Number(weather.weather_days) || 0 }
  });

  const tax = await vendorJson('GET', '/tax/quote', {
    query: { window: job.county_window, base: 'wip', cents: wip }
  });

  const net = wip + newStored + Number(fee.fee_cents) + bondCents + Number(tax.tax_cents)
    + Number(fringe.fringe_cents) - Number(retainage.ret_cents) - Number(ld.ld_cents);

  const gcLine = derived.find((d) => d.line.gc_line);
  const gcPct = gcLine ? (gcLine.billed_to_date_cents * 10000) / gcLine.line.original_cents : 0;
  const jobPct = (completedAndStored * 10000) / currentContracted;
  if (gcPct > jobPct + 500) httpError(409, 'General conditions are running ahead of the job');

  const stampedDays = payrollDays(job.id);
  await vendorJson('POST', '/payroll/status', {
    body: {
      job_id: job.id,
      period_start: periodStart,
      period_end: periodEnd,
      stamped_days: stampedDays
    }
  });

  const policies = insuranceFor(job.id);
  const gl = policies.find((p) => p.kind === 'GL_WC');
  const marine = policies.find((p) => p.kind === 'INLAND_MARINE');
  if (!gl) httpError(409, 'GL/WC is not on file');
  await vendorJson('POST', '/insurance/coi', {
    body: {
      job_id: job.id,
      period_end: periodEnd,
      gl_wc_expires_on: gl.expires_on,
      has_inland_marine: Boolean(marine),
      has_new_stored: newStored > 0
    }
  });

  if (steelWip > 0) {
    const sub = subInvoiceCovering(
      job.id,
      derived.find((d) => d.line.joint_check).line.id,
      periodStart,
      periodEnd
    );
    await vendorJson('POST', '/sub-invoice/check', {
      body: {
        steel_this_period_cents: steelWip,
        sub_invoice_cents: sub ? sub.amount_cents : 0
      }
    });
  }

  const hasDbe = derived.some((d) => d.line.dbe);
  if (hasDbe) {
    await vendorJson('POST', '/dbe/check', {
      body: { dbe_wip_cents: dbeWip, wip_ex_gc_cents: feeBaseExGc }
    });
  }

  const steelLine = derived.find((d) => d.line.joint_check);
  const steelCo = steelLine ? companyById(steelLine.line.company_id) : null;
  const payees = await vendorJson('POST', '/joint-check/payees', {
    body: {
      steel_this_period_cents: steelWip,
      gc_name: gc?.name || 'Northline Construction',
      steel_name: steelCo?.name || 'Ironclad Steel'
    }
  });

  if (net > 0) {
    await vendorJson('POST', '/encumbrance/check', {
      body: { remaining_cents: job.encumbrance_remaining_cents, net_cents: net }
    });
  }

  return {
    derived,
    wip_cents: wip,
    new_stored_cents: newStored,
    converted_cents: converted,
    fee_cents: Number(fee.fee_cents),
    bond_cents: bondCents,
    tax_cents: Number(tax.tax_cents),
    fringe_cents: Number(fringe.fringe_cents),
    retainage_cents: Number(retainage.ret_cents),
    ld_cents: Number(ld.ld_cents),
    net_cents: net,
    payees: payees.payees,
    current_contracted_cents: currentContracted
  };
}

export function newId() {
  return crypto.randomUUID();
}
