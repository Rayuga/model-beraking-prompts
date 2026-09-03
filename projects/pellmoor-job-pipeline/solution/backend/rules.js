'use strict';
// The stage machine, the gates on an offer, and the funnel — as pure functions
// over the stored pipeline. Nothing here writes.
//
// The funnel is DERIVED every time it is asked for. A stored count is a count
// that goes stale the first time somebody moves a candidate, which is the
// mistake the policy document is explicitly warning about.

const STAGES = ['applied', 'screening', 'interview', 'offer', 'hired'];
const TERMINAL = ['rejected', 'withdrawn'];
const SCORE_MIN = 1;
const SCORE_MAX = 5;
const MIN_PANEL = 2;

const isStage = (s) => STAGES.includes(s);
const isTerminal = (s) => TERMINAL.includes(s);

/**
 * May this candidate move from `from` to `to`?
 * Returns {ok:true} or {ok:false, code, error}.
 */
function admitTransition(from, to, ctx) {
  if (!isStage(to) && !isTerminal(to)) {
    return { ok: false, code: 400, error: `${to} is not a stage` };
  }
  if (from === to) {
    return { ok: false, code: 409, error: `they are already at ${to}` };
  }
  // Terminal means terminal. Not back into the pipeline, not to the other
  // terminal state either.
  if (isTerminal(from)) {
    return { ok: false, code: 409,
      error: `${from} is the end of it; if you want them again they apply again` };
  }
  // Leaving the pipeline is allowed from anywhere in it.
  if (isTerminal(to)) return { ok: true };

  const i = STAGES.indexOf(from);
  const j = STAGES.indexOf(to);
  if (j === i + 1) {
    // Forward into offer has gates of its own.
    if (to === 'offer') return admitOffer(ctx);
    return { ok: true };
  }
  if (j === i - 1) return { ok: true };          // back exactly one, always fine
  if (j > i) {
    return { ok: false, code: 409,
      error: `nobody jumps a stage; ${from} goes to ${STAGES[i + 1]} next` };
  }
  return { ok: false, code: 409,
    error: `back one stage at a time; ${from} goes back to ${STAGES[i - 1]}` };
}

/** An offer needs a proper panel and a score from every one of them. */
function admitOffer(ctx) {
  const panel = (ctx && ctx.panel) || [];
  const scores = (ctx && ctx.scores) || [];
  const managers = (ctx && ctx.managers) || [];

  if (panel.length < MIN_PANEL) {
    return { ok: false, code: 409,
      error: `an interview panel is at least ${MIN_PANEL} people; this one is ${panel.length}` };
  }
  const nonManagers = panel.filter((p) => !managers.includes(p));
  if (nonManagers.length === 0) {
    return { ok: false, code: 409,
      error: 'the hiring manager cannot be the whole panel' };
  }
  const scored = new Set(scores.map((s) => s.panel_member));
  const missing = panel.filter((p) => !scored.has(p));
  if (missing.length) {
    return { ok: false, code: 409,
      error: `waiting on a score from ${missing.join(', ')}` };
  }
  return { ok: true };
}

function admitScore(value) {
  const n = Number(value);
  if (value === null || value === undefined || value === '' || !Number.isInteger(n)) {
    return { ok: false, code: 400, error: 'a score is a whole number' };
  }
  // Both ends are real scores; the policy says so explicitly.
  if (n < SCORE_MIN || n > SCORE_MAX) {
    return { ok: false, code: 409,
      error: `scores run ${SCORE_MIN} to ${SCORE_MAX} inclusive; ${n} is outside that` };
  }
  return { ok: true };
}

/**
 * The funnel for one role, derived from where candidates are and have been.
 *
 * reached  everyone who got at least that far, including people who have since
 *          moved on or left
 * still    people standing at that stage right now
 * left     people whose last pipeline stage was this one before they went
 *          terminal. A rejection is not itself a stage.
 */
function funnel(candidates, roleCode) {
  const mine = candidates.filter((c) => c.role === roleCode);
  return STAGES.map((stage) => {
    const reached = mine.filter((c) => c.history.includes(stage)).length;
    const still = mine.filter((c) => c.stage === stage).length;
    const left = mine.filter((c) => {
      if (!isTerminal(c.stage)) return false;
      const pipeline = c.history.filter(isStage);
      return pipeline.length > 0 && pipeline[pipeline.length - 1] === stage;
    }).length;
    return { stage, reached, still, left };
  });
}

/** One person may hold two candidacies for two roles, never two for one role. */
function admitCandidate(candidates, roleCode, name) {
  const clean = String(name || '').trim();
  if (clean.length < 2) {
    return { ok: false, code: 400, error: 'a candidate needs a name' };
  }
  const dupe = candidates.some(
    (c) => c.role === roleCode && c.name.toLowerCase() === clean.toLowerCase());
  if (dupe) {
    return { ok: false, code: 409,
      error: `${clean} is already a candidate for this vacancy` };
  }
  return { ok: true, name: clean };
}

/**
 * Who may do what. The policy names three roles and the console has to mean
 * them: without this every signed-in person could move anybody's stage, which
 * makes the whole stage machine advisory.
 */
const CAN = {
  'hiring manager': ['move', 'add', 'panel', 'note', 'score'],
  'coordinator':    ['add', 'panel', 'note'],
  'panel':          ['score', 'note'],
};

function may(person, action) {
  const allowed = CAN[(person && person.role) || ''] || [];
  if (allowed.includes(action)) return { ok: true };
  return { ok: false, code: 403,
    error: `a ${person.role} does not ${action === 'move' ? 'move candidates between stages'
      : action === 'add' ? 'add candidates'
      : action === 'panel' ? 'change the panel'
      : action === 'score' ? 'score candidates' : 'do that'}` };
}

module.exports = {
  CAN, may,
  STAGES, TERMINAL, SCORE_MIN, SCORE_MAX, MIN_PANEL,
  isStage, isTerminal, admitTransition, admitOffer, admitScore, funnel,
  admitCandidate,
};
