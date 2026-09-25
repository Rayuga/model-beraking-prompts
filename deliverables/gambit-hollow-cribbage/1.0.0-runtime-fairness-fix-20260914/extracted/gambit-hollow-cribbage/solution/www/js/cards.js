
const SUIT_GLYPH = { S: '♠', H: '♥', D: '♦', C: '♣' };
const RED = { H: true, D: true };
const RANK_LABEL = { T: '10' };
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

function boardSVG(a, b, target) {
  const step = 660 / 60;
  const tracks = [
    { y: 30, score: a, colour: '#e8c04a', label: 'Seat A' },
    { y: 96, score: b, colour: '#8be5bc', label: 'Seat B' },
  ];
  const point=(score,y)=>score<=60 ? {x:30+score*step,y} : {x:690-(score-61)*step,y:y+22};
  let out = '';
  for (const r of tracks) {
    out += `<text x="30" y="${r.y-12}" fill="${r.colour}" font-size="11" font-weight="700">${r.label} · ${r.score} / ${target}</text>`;
    for (let i = 1; i <= target; i++) {
      const p=point(i,r.y),big=i%5===0||i===target;
      out += `<circle data-hole="${i}" cx="${p.x}" cy="${p.y}" r="${big?2.5:1.6}" fill="${big?'#90a995':'#526f59'}"/>`;
    }
    const p=point(Math.max(0,Math.min(target,r.score)),r.y);
    out += `<circle data-peg="${r.label}" cx="${p.x}" cy="${p.y}" r="5" fill="${r.colour}"
             stroke="rgba(0,0,0,.45)" stroke-width="1.5">
             <title>${r.label}: ${r.score} of ${target}</title></circle>`;
    out += `<text x="30" y="${r.y+36}" font-size="9" fill="#c2d0ba">121 · finish</text><text x="650" y="${r.y+36}" font-size="9" fill="#c2d0ba">61</text>`;
  }
  return out;
}
