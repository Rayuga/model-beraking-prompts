'use strict';

const STAGES = ['applied', 'screening', 'interview', 'offer', 'hired'];
const TERMINAL = ['rejected', 'withdrawn'];
const SCORE_MIN = 1;
const SCORE_MAX = 5;
const MIN_PANEL = 2;

const isStage = (s) => STAGES.includes(s);
const isTerminal = (s) => TERMINAL.includes(s);


function admitTransition(from, to, ctx) {
  if (!isStage(to) && !isTerminal(to)) {
    return { ok: false, code: 400, error: `${to} is not a stage` };
  }
  if (from === to) {
    return { ok: false, code: 409, error: `they are already at ${to}` };
  }
  if (isTerminal(from)) {
    return { ok: false, code: 409,
      error: `${from} is the end of it; if you want them again they apply again` };
  }
  if (isTerminal(to)) return { ok: true };

  const i = STAGES.indexOf(from);
  const j = STAGES.indexOf(to);
  if (j === i + 1) {
    if (to === 'offer') return admitOffer(ctx);
    return { ok: true };
  }
  if (j === i - 1) return { ok: true };
  if (j > i) {
    return { ok: false, code: 409,
      error: `nobody jumps a stage; ${from} goes to ${STAGES[i + 1]} next` };
  }
  return { ok: false, code: 409,
    error: `back one stage at a time; ${from} goes back to ${STAGES[i - 1]}` };
}


function admitOffer(ctx) {
  const panel = (ctx && ctx.panel) || [];
  const scores = (ctx && ctx.scores) || [];
  const managers = (ctx && ctx.managers) || [];

  if (panel.length < MIN_PANEL) {
    const managerOnly = panel.length > 0 && panel.every((p) => managers.includes(p));
    return { ok: false, code: 409,
      error: `an interview panel is at least ${MIN_PANEL} people; this one is ${panel.length}`
        + (managerOnly ? ' and the hiring manager cannot be the whole panel' : '') };
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
  const n = value;
  if (typeof n !== 'number' || !Number.isInteger(n)) {
    return { ok: false, code: 400, error: 'a score is a whole number' };
  }
  if (n < SCORE_MIN || n > SCORE_MAX) {
    return { ok: false, code: 409,
      error: `scores run ${SCORE_MIN} to ${SCORE_MAX} inclusive; ${n} is outside that` };
  }
  return { ok: true };
}


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


const CAN = {
  'hiring manager': ['move', 'note', 'score'],
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
