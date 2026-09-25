'use strict';
// Gambit Hollow. One Express process: the JSON API and the static browser side.
//
// CommonJS deliberately — there is no build step and no package.json "type", so
// this is what Node expects here.

const express = require('express');
const Database = require('better-sqlite3');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const S = require('./lib/scoring.js');
const G = require('./lib/game.js');

const ROOT = __dirname;
const DB_PATH = process.env.DB_PATH || path.join(ROOT, 'gambit.db');
const SEED = process.env.SEED_PATH || '/club/records/gambit_seed_data.json';
const PORT = Number(process.env.PORT || 3000);

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.exec(`
CREATE TABLE IF NOT EXISTS members (
  no TEXT PRIMARY KEY, name TEXT NOT NULL,
  played INTEGER NOT NULL, won INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY, dealer TEXT NOT NULL, pone TEXT NOT NULL,
  dealer_score INTEGER NOT NULL, pone_score INTEGER NOT NULL,
  finished INTEGER NOT NULL, state TEXT);
`);

function seed() {
  if (db.prepare('SELECT COUNT(*) n FROM members').get().n > 0) return;
  const s = JSON.parse(fs.readFileSync(SEED, 'utf8'));
  for (const m of s.members) {
    db.prepare('INSERT INTO members (no,name,played,won) VALUES (?,?,?,?)')
      .run(m.no, m.name, m.played, m.won);
  }
  for (const g of s.games) {
    db.prepare(`INSERT INTO games (id,dealer,pone,dealer_score,pone_score,finished,state)
      VALUES (?,?,?,?,?,?,NULL)`)
      .run(g.id, g.dealer, g.pone, g.dealer_score, g.pone_score, g.finished ? 1 : 0);
  }
}
seed();

// Deals are random, but a game's deal is stored with it, so reloading mid-play
// gives back the same cards rather than a fresh shuffle.
const rng = () => crypto.randomInt(0, 2 ** 30) / 2 ** 30;

const app = express();
app.use(express.json({ limit: '64kb' }));

const load = (id) => {
  const row = db.prepare('SELECT * FROM games WHERE id=?').get(id);
  if (!row) return null;
  return { row, g: row.state ? JSON.parse(row.state) : null };
};
const save = (id, g, scores, finished) =>
  db.prepare(`UPDATE games SET state=?, dealer_score=?, pone_score=?, finished=?
              WHERE id=?`)
    .run(JSON.stringify(g), scores.a, scores.b, finished ? 1 : 0, id);

// Hidden information stays hidden: a player is only ever sent their own hand.
function visible(g, scores, seat) {
  const other = seat === 'a' ? 'b' : 'a';
  return {
    phase: g.phase,
    // which hand of the game this is. A cribbage game is a sequence of hands
    // and the deal alternates between them, so the number is worth showing.
    hand_no: g.hand_no || 1,
    dealer: g.dealer,
    turn: g.turn,
    seat,
    you: {
      hand: g.kept[seat] || g.hands[seat],
      // A player knows what they discarded, so their own two are never hidden
      // from them. The other player's stay face down until the show.
      cribCards: (g.cribBy && g.cribBy[seat]) || [],
      laid: g.laid[seat],
      remaining: g.kept[seat] ? G.remaining(g, seat) : [],
      discarded: Boolean(g.kept[seat]),
    },
    them: {
      cards: (g.kept[other] || g.hands[other] || []).length,
      laid: g.laid[other],
      discarded: Boolean(g.kept[other]),
    },
    cut: g.cut,
    pile: g.pile,
    count: g.count,
    crib: g.phase === 'over' || g.shown.length === 3 ? g.crib : g.crib.length,
    shown: g.shown,
    events: g.events.slice(-8),
    scores,
    target: G.TARGET,
  };
}

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.get('/api/ladder', (_req, res) => {
  res.json({
    members: db.prepare('SELECT * FROM members ORDER BY won DESC, played ASC').all(),
    games: db.prepare('SELECT id,dealer,pone,dealer_score,pone_score,finished FROM games').all(),
  });
});

// Score any hand on demand. This is the endpoint the supplied fixture is checked
// against, and it takes no game state at all — scoring is a pure question.
app.post('/api/score', (req, res) => {
  const { hand, cut, crib } = req.body || {};
  if (!Array.isArray(hand)) return res.status(409).json({ error: 'hand is four cards' });
  const r = S.scoreHand(hand, cut === undefined ? null : cut, Boolean(crib));
  if (r.error) return res.status(409).json({ error: r.error });
  res.json(r);
});

app.post('/api/play/score', (req, res) => {
  const { pile, card } = req.body || {};
  const r = S.scorePlay(Array.isArray(pile) ? pile : [], card);
  if (r.error) return res.status(409).json({ error: r.error });
  res.json(r);
});

// What is still in play. Without this a game whose id the browser has lost is
// unreachable, even though it is sitting in the database -- which is how a
// reload came to empty the board.
app.get('/api/games', (_req, res) => {
  const rows = db.prepare(`SELECT id, dealer, pone, dealer_score, pone_score, state
                           FROM games WHERE finished=0 ORDER BY rowid DESC LIMIT 20`).all();
  res.json({
    games: rows.map((r) => {
      const g = r.state ? JSON.parse(r.state) : {};
      return {
        id: r.id, dealer: r.dealer, pone: r.pone,
        scores: { a: r.dealer_score, b: r.pone_score },
        phase: g.phase || 'unknown', hand_no: g.hand_no || 1,
      };
    }),
  });
});

app.post('/api/games', (req, res) => {
  const dealer = String((req.body || {}).dealer || 'M-014');
  const pone = String((req.body || {}).pone || 'M-021');
  if (dealer === pone) return res.status(409).json({ error: 'a game needs two players' });
  for (const m of [dealer, pone]) {
    if (!db.prepare('SELECT 1 FROM members WHERE no=?').get(m)) {
      return res.status(404).json({ error: `no member ${m}` });
    }
  }
  // A game may start from a stated score, for practising an endgame. Reaching
  // 121 from nothing is about eleven hands, so without this the one rule the
  // brief cares most about -- stopping the instant somebody reaches the target
  // -- cannot be watched happening. It is a SETUP value, bounded below the
  // target, not a result the server is being told.
  const start = (req.body || {}).start_scores;
  const scores = { a: 0, b: 0 };
  if (start !== undefined) {
    if (typeof start !== 'object' || start === null) {
      return res.status(409).json({ error: 'start_scores is {a, b}' });
    }
    for (const seat of ['a', 'b']) {
      const v = Number(start[seat] ?? 0);
      if (!Number.isInteger(v) || v < 0 || v >= G.TARGET) {
        return res.status(409).json({
          error: `a starting score is a whole number from 0 to ${G.TARGET - 1}`,
        });
      }
      scores[seat] = v;
    }
  }
  const id = 'G-' + crypto.randomBytes(3).toString('hex').toUpperCase();
  const g = G.deal('a', rng);
  db.prepare(`INSERT INTO games (id,dealer,pone,dealer_score,pone_score,finished,state)
    VALUES (?,?,?,?,?,0,?)`)
    .run(id, dealer, pone, scores.a, scores.b, JSON.stringify(g));
  res.status(201).json({ id, ...visible(g, scores, 'a') });
});

app.get('/api/games/:id', (req, res) => {
  const found = load(req.params.id);
  if (!found || !found.g) return res.status(404).json({ error: 'no such game in play' });
  const seat = req.query.seat === 'b' ? 'b' : 'a';
  const scores = { a: found.row.dealer_score, b: found.row.pone_score };
  res.json({ id: found.row.id, ...visible(found.g, scores, seat) });
});

function act(req, res, fn) {
  const found = load(req.params.id);
  if (!found || !found.g) return res.status(404).json({ error: 'no such game in play' });
  if (found.g.phase === 'over') {
    return res.status(409).json({ error: 'that game is over' });
  }
  const scores = { a: found.row.dealer_score, b: found.row.pone_score };
  const seat = (req.body || {}).seat === 'b' ? 'b' : 'a';
  const r = fn(found.g, scores, seat);
  if (r.error) return res.status(409).json({ error: r.error });
  const over = found.g.phase === 'over';
  save(found.row.id, found.g, scores, over);
  // A win is credited only when somebody actually reached the target. The old
  // test was `scores.a >= TARGET ? dealer : pone`, whose else-branch handed the
  // game to the pone whenever it ended for any other reason -- which, while the
  // hand was ending the game, was every single game.
  if (over && (scores.a >= G.TARGET || scores.b >= G.TARGET)) {
    const winner = scores.a >= G.TARGET ? found.row.dealer : found.row.pone;
    db.prepare('UPDATE members SET played=played+1 WHERE no IN (?,?)')
      .run(found.row.dealer, found.row.pone);
    db.prepare('UPDATE members SET won=won+1 WHERE no=?').run(winner);
  }
  res.json({ id: found.row.id, ...r, ...visible(found.g, scores, seat) });
}

app.post('/api/games/:id/discard', (req, res) =>
  act(req, res, (g, _s, seat) => G.discard(g, seat, (req.body || {}).cards)));

app.post('/api/games/:id/cut', (req, res) =>
  act(req, res, (g, scores) => G.cutCard(g, scores)));

app.post('/api/games/:id/play', (req, res) =>
  act(req, res, (g, scores, seat) => G.play(g, seat, (req.body || {}).card, scores)));

app.post('/api/games/:id/show', (req, res) =>
  act(req, res, (g, scores) => G.show(g, scores)));

// The next hand of a game whose last hand is counted. Separate from /show so
// the three counts stay readable until the players are done with them.
app.post('/api/games/:id/deal', (req, res) =>
  act(req, res, (g) => G.nextHand(g, rng)));

app.use(express.static(path.join(ROOT, 'www')));
// The catch-all serves the page, but only for a NAVIGATION. A path that looks
// like a file and was not matched by express.static is a missing file, and it
// has to say so: answering it with index.html and a 200 means a missing or
// misspelled asset reaches the browser as HTML labelled otherwise, the page
// dies on a MIME error, and any probe that only checks the status sees a
// healthy server. A 404 is the honest answer and the loud one.
app.get(/.*/, (req, res) => {
  if (/\.[a-z0-9]+$/i.test(req.path)) {
    res.status(404).type('text/plain').send('not found');
    return;
  }
  res.sendFile(path.join(ROOT, 'www', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => console.log(`gambit on ${PORT}`));
