'use strict';
// Every operational rule the ops floor complained about, in one place.
//
// Each function takes the STORED records and returns null when the action is
// allowed or {code, message} when it is refused. Nothing here ever reads a
// client-supplied figure: propellant, battery, window, delta-v and checkout
// all come out of the database row. That is what makes a forged request body
// worthless.

// The threshold is NOT a constant here: it is read from the seeded
// configuration (the ops workbook's Thresholds tab), because ops change it
// without telling anyone. Default only guards a missing config row.
const DEFAULT_HIGH_ENERGY_DELTA_V_MS = 50;
const TERMINAL = new Set(['EXECUTED', 'CANCELLED']);

const refuse = (code, message) => ({ code, message });

// A command is spent once it has gone out or been pulled. Nothing further
// happens to it — not authorize, not execute, not cancel.
function checkNotTerminal(cmd) {
  if (TERMINAL.has(cmd.status)) {
    return refuse(
      'COMMAND_FINAL',
      `${cmd.ref} is already ${cmd.status.toLowerCase()} and takes no further action.`
    );
  }
  return null;
}

// The checkout is what says whether a craft can fly. Cancelling the offending
// command does not clear it; only a new checkout does.
function checkCheckout(craft) {
  if (craft.checkout !== 'PASSED') {
    return refuse(
      'CHECKOUT_FAILED',
      `${craft.code} last checkout is ${craft.checkout}; it takes no commands until a checkout passes.`
    );
  }
  return null;
}

// The command has to sit entirely inside one contact window belonging to THAT
// craft. Filling a window exactly, end to end, is allowed. Checked here (at
// execution) and not only at queue time — a command legal when queued can
// stop being legal before it runs.
function checkPassWindow(cmd, passes) {
  const start = Date.parse(cmd.starts_at);
  const end = Date.parse(cmd.ends_at);
  if (!(end > start)) {
    return refuse('WINDOW_INVALID', 'Command window ends before it starts.');
  }
  const covering = passes.find(
    (p) =>
      p.craft_code === cmd.craft_code &&
      Date.parse(p.opens_at) <= start &&
      Date.parse(p.closes_at) >= end
  );
  if (!covering) {
    return refuse(
      'NO_CONTACT_WINDOW',
      `No contact window for ${cmd.craft_code} covers ${cmd.starts_at} to ${cmd.ends_at}.`
    );
  }
  return null;
}

// The burn has to fit what is LEFT in the tank, not the tank's rated size.
// Spending exactly the remainder is allowed.
function checkPropellant(cmd, craft) {
  const need = Number(cmd.propellant_kg) || 0;
  const have = Number(craft.propellant_kg) || 0;
  if (need > have + 1e-9) {
    return refuse(
      'PROPELLANT_SHORT',
      `${cmd.ref} needs ${need} kg; ${craft.code} has ${have} kg remaining.`
    );
  }
  return null;
}

// The draw is taken off the charge the craft actually has, and must not go
// under the reserve. Landing exactly on the reserve is allowed.
function checkBattery(cmd, craft) {
  const draw = Number(cmd.battery_draw_pct) || 0;
  const after = Number(craft.battery_pct) - draw;
  if (after < Number(craft.reserve_pct)) {
    return refuse(
      'BATTERY_RESERVE',
      `${cmd.ref} would leave ${craft.code} at ${after}%, under its ${craft.reserve_pct}% reserve.`
    );
  }
  return null;
}

// ABOVE the line it takes two people; AT the line it is the operator's own
// call. The second signature may not be the submitter's.
function needsAuthorization(cmd, th = {}) {
  const limit = Number(th.highEnergyDeltaV ?? DEFAULT_HIGH_ENERGY_DELTA_V_MS);
  return Number(cmd.delta_v_ms) > limit;
}

function checkAuthorization(cmd, th) {
  if (!needsAuthorization(cmd, th)) return null;
  if (!cmd.authorized_by) {
    return refuse(
      'AUTHORIZATION_REQUIRED',
      `${cmd.ref} is ${cmd.delta_v_ms} m/s and needs a flight director's authorization.`
    );
  }
  if (cmd.submitted_by && cmd.authorized_by === cmd.submitted_by) {
    return refuse(
      'SELF_AUTHORIZED',
      'The person who submitted a burn cannot be the one who authorizes it.'
    );
  }
  return null;
}

// Gate for the authorize write itself. The role and identity are re-read from
// the database at call time, so a director just demoted is refused here even
// though their console still showed the button.
function canAuthorize(cmd, actor) {
  if (actor.role !== 'flight_director') {
    return refuse('NOT_FLIGHT_DIRECTOR', 'Only a flight director can authorize a burn.');
  }
  const terminal = checkNotTerminal(cmd);
  if (terminal) return terminal;
  if (cmd.authorized_by) {
    return refuse('ALREADY_AUTHORIZED', `${cmd.ref} is already authorized.`);
  }
  if (cmd.submitted_by === actor.email) {
    return refuse(
      'SELF_AUTHORIZED',
      'The person who submitted a burn cannot be the one who authorizes it.'
    );
  }
  return null;
}

// Full pre-uplink gate, in the order the floor reads them.
function canExecute(cmd, craft, passes, actor, th) {
  if (!['operator', 'flight_director'].includes(actor.role)) {
    return refuse('NOT_PERMITTED', 'Your role cannot uplink commands.');
  }
  return (
    checkNotTerminal(cmd) ||
    checkCheckout(craft) ||
    checkPassWindow(cmd, passes) ||
    checkPropellant(cmd, craft) ||
    checkBattery(cmd, craft) ||
    checkAuthorization(cmd, th) ||
    null
  );
}

function canCancel(cmd, actor) {
  if (!['operator', 'flight_director'].includes(actor.role)) {
    return refuse('NOT_PERMITTED', 'Your role cannot cancel commands.');
  }
  return checkNotTerminal(cmd);
}

module.exports = {
  DEFAULT_HIGH_ENERGY_DELTA_V_MS,
  TERMINAL,
  needsAuthorization,
  checkNotTerminal,
  checkCheckout,
  checkPassWindow,
  checkPropellant,
  checkBattery,
  checkAuthorization,
  canAuthorize,
  canExecute,
  canCancel,
};
