'use strict';

const express = require('express');
const Database = require('better-sqlite3');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const S = require('./lib/scoring.js');
const G = require('./lib/game.js');

const ROOT = __dirname;
const DB_PATH = process.env.DB_PATH || path.join(ROOT, 'gambit.db');
const SEED = process.env.SEED_PATH || '/assets/club/records/gambit_seed_data.json';
const PRACTICE = require('/assets/club/practice-deals.json');
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
db.transaction(seed)();
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
function visible(g, scores, seat, row) {
  const other = seat === 'a' ? 'b' : 'a';
  return {
    phase: g.phase,
    hand_no: g.hand_no || 1,
    dealer: g.dealer,
    turn: g.turn,
    seat,
    players: {
      a: db.prepare('SELECT no,name FROM members WHERE no=?').get(row.dealer),
      b: db.prepare('SELECT no,name FROM members WHERE no=?').get(row.pone),
    },
    you: {
      hand: g.kept[seat] || g.hands[seat],
      cribCards: (g.cribBy && g.cribBy[seat]) || [],
      laid: g.laid[seat],
      remaining: g.kept[seat] ? G.remaining(g, seat) : [],
      discarded: Boolean(g.kept[seat]),
    },
    them: {
      cards: g.kept[other] ? G.remaining(g, other).length : g.hands[other].length,
      laid: g.laid[other],
      discarded: Boolean(g.kept[other]),
    },
    cut: g.cut,
    pile: g.pile,
    count: g.count,
    crib: g.shown.some(s=>s.label==='crib') ? g.crib : g.crib.length,
    shown: g.shown,
    events: g.events.slice(-8),
    scores,
    target: G.TARGET,
  };
}

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/api/practice', (_req,res) => res.json(PRACTICE));

app.get('/api/ladder', (_req, res) => {
  res.json({
    members: db.prepare('SELECT * FROM members ORDER BY won DESC, played ASC').all(),
    games: db.prepare('SELECT id,dealer,pone,dealer_score,pone_score,finished FROM games').all(),
  });
});
app.post('/api/score', (req, res) => {
  const { hand, cut, crib } = req.body || {};
  if (!Array.isArray(hand)) return res.status(409).json({ error: 'hand is four cards' });
  if (typeof crib !== 'boolean') return res.status(409).json({error:'crib must be true or false'});
  const r = S.scoreHand(hand, cut, crib);
  if (r.error) return res.status(409).json({ error: r.error });
  res.json(r);
});

app.post('/api/play/score', (req, res) => {
  const { pile, card } = req.body || {};
  if (!Array.isArray(pile)) return res.status(409).json({error:'pile must be a card list'});
  const r = S.scorePlay(pile, card);
  if (r.error) return res.status(409).json({ error: r.error });
  res.json(r);
});
app.get('/api/games', (_req, res) => {
  const rows = db.prepare(`SELECT id, dealer, pone, dealer_score, pone_score, state
                           FROM games WHERE finished=0 AND state IS NOT NULL ORDER BY rowid DESC`).all();
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
  const start = (req.body || {}).start_scores;
  const scores = { a: 0, b: 0 };
  if (start !== undefined) {
    if (typeof start !== 'object' || start === null || Array.isArray(start)) {
      return res.status(409).json({ error: 'start_scores is {a, b}' });
    }
    for (const seat of ['a', 'b']) {
      const v = start[seat] ?? 0;
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
  if ((req.body || {}).practice !== undefined) {
    if (!Object.hasOwn(PRACTICE,req.body.practice)) return res.status(409).json({error:'Unknown practice deal'});
    const preset=PRACTICE[req.body.practice];
    g.hands={a:preset.a.slice(),b:preset.b.slice()};
    g.stock=[preset.cut];
  }
  db.prepare(`INSERT INTO games (id,dealer,pone,dealer_score,pone_score,finished,state)
    VALUES (?,?,?,?,?,0,?)`)
    .run(id, dealer, pone, scores.a, scores.b, JSON.stringify(g));
  res.status(201).json({ id, ...visible(g, scores, 'a', {dealer,pone}) });
});

app.get('/api/games/:id', (req, res) => {
  const found = load(req.params.id);
  if (!found || !found.g) return res.status(404).json({ error: 'no such game in play' });
  const seat = req.query.seat === 'b' ? 'b' : 'a';
  const scores = { a: found.row.dealer_score, b: found.row.pone_score };
  res.json({ id: found.row.id, ...visible(found.g, scores, seat, found.row) });
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
  db.transaction(() => {
  save(found.row.id, found.g, scores, over);
  if (over && (scores.a >= G.TARGET || scores.b >= G.TARGET)) {
    const winner = scores.a >= G.TARGET ? found.row.dealer : found.row.pone;
    db.prepare('UPDATE members SET played=played+1 WHERE no IN (?,?)')
      .run(found.row.dealer, found.row.pone);
    db.prepare('UPDATE members SET won=won+1 WHERE no=?').run(winner);
  }
  })();
  res.json({ id: found.row.id, ...r, ...visible(found.g, scores, seat, found.row) });
}

app.post('/api/games/:id/discard', (req, res) =>
  act(req, res, (g, _s, seat) => G.discard(g, seat, (req.body || {}).cards)));

app.post('/api/games/:id/cut', (req, res) =>
  act(req, res, (g, scores) => G.cutCard(g, scores)));

app.post('/api/games/:id/play', (req, res) =>
  act(req, res, (g, scores, seat) => G.play(g, seat, (req.body || {}).card, scores)));

app.post('/api/games/:id/show', (req, res) =>
  act(req, res, (g, scores) => G.show(g, scores)));
app.post('/api/games/:id/deal', (req, res) =>
  act(req, res, (g) => G.nextHand(g, rng)));

app.use(express.static(path.join(ROOT, 'www')));
app.use('/api', (_req,res)=>res.status(404).json({error:'Unknown route'}));
app.get(/.*/, (req, res) => {
  if (/\.[a-z0-9]+$/i.test(req.path)) {
    res.status(404).type('text/plain').send('not found');
    return;
  }
  res.sendFile(path.join(ROOT, 'www', 'index.html'));
});

app.use((error,_req,res,_next)=>res.status(error.status===400?400:500).json({error:error.status===400?'Invalid JSON request':'Unable to complete request'}));
app.listen(PORT, '0.0.0.0', () => console.log(`gambit on ${PORT}`));
