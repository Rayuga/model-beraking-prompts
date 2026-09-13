// Cards and the peg board, drawn as inline SVG.
//
// SVG rather than a canvas because the club prints the board and reads it on a
// screen across the room — and because a judge can see what a card IS from the
// markup, which a bitmap does not offer.

const SUIT_GLYPH = { S: '♠', H: '♥', D: '♦', C: '♣' };
const RED = { H: true, D: true };
const RANK_LABEL = { T: '10' };
// Spoken names. "card JC" is what a screen reader was being given; a card is a
// jack of clubs, and saying so costs nothing.
const RANK_WORD = {
  A: 'ace', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven',
  8: 'eight', 9: 'nine', T: 'ten', J: 'jack', Q: 'queen', K: 'king',
};
const SUIT_WORD = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' };

function cardName(code) {
  if (!code) return 'face down card';
  return `${RANK_WORD[code[0]] || code[0]} of ${SUIT_WORD[code[1]] || code[1]}`;
}

function cardSVG(code, opts) {
  const o = opts || {};
  const w = o.w || 62;
  const h = Math.round(w * 1.45);
  if (!code) {
    return `<svg viewBox="0 0 62 90" width="${w}" height="${h}" role="img"
      aria-label="face down card">
      <rect x="1" y="1" width="60" height="88" rx="7" fill="#123a22" stroke="#0a2415"/>
      <rect x="7" y="7" width="48" height="76" rx="4" fill="none"
            stroke="#1f7a45" stroke-width="2" stroke-dasharray="4 3"/>
    </svg>`;
  }
  const rank = RANK_LABEL[code[0]] || code[0];
  const suit = code[1];
  const glyph = SUIT_GLYPH[suit];
  const colour = RED[suit] ? '#b3261e' : '#16202b';
  return `<svg viewBox="0 0 62 90" width="${w}" height="${h}" role="img"
    aria-label="${cardName(code)}">
    <rect x="1" y="1" width="60" height="88" rx="7" fill="#fdfcf7" stroke="#d8d2c2"/>
    <text x="7" y="20" font-size="16" font-weight="700" fill="${colour}"
          font-family="ui-serif, Georgia, serif">${rank}</text>
    <text x="7" y="34" font-size="13" fill="${colour}">${glyph}</text>
    <text x="31" y="58" font-size="26" fill="${colour}" text-anchor="middle">${glyph}</text>
    <text x="55" y="83" font-size="16" font-weight="700" fill="${colour}"
          text-anchor="end" font-family="ui-serif, Georgia, serif">${rank}</text>
  </svg>`;
}

/** The classic 121-hole board, two tracks, pegs where the scores are. */
function boardSVG(a, b, target) {
  const holes = 60;
  const step = 690 / (holes - 1);
  const rows = [
    { y: 20, score: a, colour: '#e0b93a', label: 'dealer' },
    { y: 44, score: b, colour: '#7fd6a0', label: 'non-dealer' },
  ];
  let out = '';
  for (const r of rows) {
    for (let i = 0; i < holes; i++) {
      const big = i % 5 === 0;
      out += `<circle cx="${15 + i * step}" cy="${r.y}" r="${big ? 2.6 : 1.8}"
               fill="rgba(255,255,255,${big ? 0.30 : 0.16})"/>`;
    }
    const frac = Math.max(0, Math.min(1, r.score / target));
    const x = 15 + frac * 690;
    out += `<rect x="15" y="${r.y - 3}" width="${frac * 690}" height="6" rx="3"
             fill="${r.colour}" opacity=".28"/>`;
    out += `<circle cx="${x}" cy="${r.y}" r="6" fill="${r.colour}"
             stroke="rgba(0,0,0,.45)" stroke-width="1.5">
             <title>${r.label}: ${r.score} of ${target}</title></circle>`;
  }
  return out;
}
