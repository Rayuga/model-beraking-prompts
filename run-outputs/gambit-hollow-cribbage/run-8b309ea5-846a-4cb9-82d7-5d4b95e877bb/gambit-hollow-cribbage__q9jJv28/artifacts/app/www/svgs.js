// SVG Rendering Helpers for Gambit Hollow

const SUIT_SYMBOLS = {
  'S': '♠',
  'H': '♥',
  'D': '♦',
  'C': '♣'
};

const SUIT_NAMES = {
  'S': 'Spades',
  'H': 'Hearts',
  'D': 'Diamonds',
  'C': 'Clubs'
};

const RANK_LABELS = {
  'A': 'A', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6',
  '7': '7', '8': '8', '9': '9', 'T': '10', '10': '10',
  'J': 'J', 'Q': 'Q', 'K': 'K'
};

function getCardColor(suit) {
  return (suit === 'H' || suit === 'D') ? '#dc2626' : '#0f172a';
}

/**
 * Generate inline SVG string for a playing card.
 */
function renderCardSvg(cardCode, { width = 80, height = 116, selected = false, disabled = false } = {}) {
  if (!cardCode || cardCode === '??') {
    // Render face-down card back
    return `
      <svg class="crib-card card-back" viewBox="0 0 100 144" width="${width}" height="${height}" role="img" aria-label="Card face down">
        <defs>
          <pattern id="cardBackPattern" width="12" height="12" patternUnits="userSpaceOnUse">
            <rect width="12" height="12" fill="#1e3a5f" />
            <path d="M0 6 L6 0 L12 6 L6 12 Z" fill="#2b4c7e" />
            <circle cx="6" cy="6" r="2" fill="#d4af37" />
          </pattern>
        </defs>
        <rect x="2" y="2" width="96" height="140" rx="8" ry="8" fill="#f8fafc" stroke="#334155" stroke-width="2"/>
        <rect x="6" y="6" width="88" height="132" rx="6" ry="6" fill="url(#cardBackPattern)" stroke="#1e293b" stroke-width="1.5"/>
        <circle cx="50" cy="72" r="18" fill="#1e293b" stroke="#d4af37" stroke-width="2"/>
        <text x="50" y="78" font-family="serif" font-size="20" font-weight="bold" fill="#d4af37" text-anchor="middle">GH</text>
      </svg>
    `;
  }

  const norm = cardCode.trim().toUpperCase();
  const rankChar = norm[0] === '1' ? 'T' : norm[0];
  const suitChar = norm[norm.length - 1];
  const rankLabel = RANK_LABELS[rankChar] || rankChar;
  const suitSym = SUIT_SYMBOLS[suitChar] || suitChar;
  const color = getCardColor(suitChar);
  const selClass = selected ? ' card-selected' : '';
  const disClass = disabled ? ' card-disabled' : '';

  return `
    <svg class="crib-card${selClass}${disClass}" viewBox="0 0 100 144" width="${width}" height="${height}" role="img" aria-label="${rankLabel} of ${SUIT_NAMES[suitChar] || suitChar}">
      <rect x="2" y="2" width="96" height="140" rx="8" ry="8" fill="#ffffff" stroke="${selected ? '#eab308' : '#cbd5e1'}" stroke-width="${selected ? '3.5' : '1.5'}"/>
      <!-- Top-left rank & suit -->
      <text x="8" y="22" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="bold" fill="${color}">${rankLabel}</text>
      <text x="8" y="38" font-family="system-ui, -apple-system, sans-serif" font-size="16" fill="${color}">${suitSym}</text>
      <!-- Center Graphic -->
      <g transform="translate(50, 72)">
        <text x="0" y="16" font-family="system-ui, -apple-system, sans-serif" font-size="44" fill="${color}" text-anchor="middle">${suitSym}</text>
      </g>
      <!-- Bottom-right rank & suit rotated -->
      <g transform="rotate(180 50 72)">
        <text x="8" y="22" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="bold" fill="${color}">${rankLabel}</text>
        <text x="8" y="38" font-family="system-ui, -apple-system, sans-serif" font-size="16" fill="${color}">${suitSym}</text>
      </g>
    </svg>
  `;
}

/**
 * Generate inline SVG for the Peg Board (121 holes, 2 tracks).
 */
function renderPegBoardSvg(scoreA = 0, scoreB = 0, target = 121, prevA = 0, prevB = 0) {
  const clampedA = Math.max(0, Math.min(121, scoreA));
  const clampedB = Math.max(0, Math.min(121, scoreB));
  const clampedPrevA = Math.max(0, Math.min(121, prevA));
  const clampedPrevB = Math.max(0, Math.min(121, prevB));

  const holeRadius = 3;
  const colSpacing = 24;
  const startX = 50;
  const rowHeight = 44;
  const startY = 40;

  function getHoleCoords(holeNumber, track) {
    if (holeNumber <= 0) return null;
    if (holeNumber === 121) {
      // Finish hole
      return { x: startX + 30 * colSpacing + 30, y: startY + 1.5 * rowHeight + (track === 'A' ? -8 : 8) };
    }

    const rowIdx = Math.floor((holeNumber - 1) / 30); // 0, 1, 2, 3
    const posInRow = (holeNumber - 1) % 30; // 0..29

    let x;
    if (rowIdx % 2 === 0) {
      // Left to right
      x = startX + posInRow * colSpacing;
    } else {
      // Right to left
      x = startX + (29 - posInRow) * colSpacing;
    }

    const y = startY + rowIdx * rowHeight + (track === 'A' ? 0 : 16);
    return { x, y };
  }

  let holesSvg = '';

  // Draw 5-hole group separators and labels
  for (let r = 0; r < 4; r++) {
    const yRow = startY + r * rowHeight;
    const streetEnd = (r + 1) * 30;
    const labelX = r % 2 === 0 ? startX - 25 : startX + 30 * colSpacing + 10;
    holesSvg += `<text x="${labelX}" y="${yRow + 12}" font-family="system-ui, sans-serif" font-size="11" font-weight="bold" fill="#94a3b8" text-anchor="middle">${streetEnd}</text>`;

    for (let c = 0; c < 30; c++) {
      const x = startX + c * colSpacing;
      
      // Group dividers every 5 holes
      if (c % 5 === 0 && c > 0) {
        holesSvg += `<line x1="${x - colSpacing/2}" y1="${yRow - 4}" x2="${x - colSpacing/2}" y2="${yRow + 22}" stroke="#475569" stroke-dasharray="2,2" stroke-width="1"/>`;
      }

      // Hole for Track A
      holesSvg += `<circle cx="${x}" cy="${yRow}" r="${holeRadius}" fill="#0f172a" stroke="#475569" stroke-width="1"/>`;
      // Hole for Track B
      holesSvg += `<circle cx="${x}" cy="${yRow + 16}" r="${holeRadius}" fill="#0f172a" stroke="#475569" stroke-width="1"/>`;
    }
  }

  // Finish Hole (121)
  const finishA = getHoleCoords(121, 'A');
  const finishB = getHoleCoords(121, 'B');
  holesSvg += `
    <g class="finish-hole">
      <circle cx="${finishA.x}" cy="${finishA.y}" r="6" fill="#0f172a" stroke="#eab308" stroke-width="2"/>
      <circle cx="${finishB.x}" cy="${finishB.y}" r="6" fill="#0284c7" stroke="#38bdf8" stroke-width="2"/>
      <text x="${finishA.x}" y="${finishA.y - 12}" font-family="system-ui, sans-serif" font-size="11" font-weight="bold" fill="#eab308" text-anchor="middle">121</text>
    </g>
  `;

  // Draw Pegs for Player A (Gold)
  let pegsSvg = '';
  if (clampedA > 0) {
    const coordsA = getHoleCoords(clampedA, 'A');
    if (coordsA) {
      pegsSvg += `
        <circle cx="${coordsA.x}" cy="${coordsA.y}" r="6" fill="#eab308" stroke="#ffffff" stroke-width="2">
          <title>Seat A Front Peg: ${clampedA}</title>
        </circle>
      `;
    }
    if (clampedPrevA > 0 && clampedPrevA !== clampedA) {
      const coordsPrevA = getHoleCoords(clampedPrevA, 'A');
      if (coordsPrevA) {
        pegsSvg += `
          <circle cx="${coordsPrevA.x}" cy="${coordsPrevA.y}" r="4.5" fill="#ca8a04" stroke="#fef08a" stroke-width="1" opacity="0.8">
            <title>Seat A Back Peg: ${clampedPrevA}</title>
          </circle>
        `;
      }
    }
  }

  // Draw Pegs for Player B (Cyan/Silver)
  if (clampedB > 0) {
    const coordsB = getHoleCoords(clampedB, 'B');
    if (coordsB) {
      pegsSvg += `
        <circle cx="${coordsB.x}" cy="${coordsB.y}" r="6" fill="#38bdf8" stroke="#ffffff" stroke-width="2">
          <title>Seat B Front Peg: ${clampedB}</title>
        </circle>
      `;
    }
    if (clampedPrevB > 0 && clampedPrevB !== clampedB) {
      const coordsPrevB = getHoleCoords(clampedPrevB, 'B');
      if (coordsPrevB) {
        pegsSvg += `
          <circle cx="${coordsPrevB.x}" cy="${coordsPrevB.y}" r="4.5" fill="#0284c7" stroke="#bae6fd" stroke-width="1" opacity="0.8">
            <title>Seat B Back Peg: ${clampedPrevB}</title>
          </circle>
        `;
      }
    }
  }

  const totalWidth = startX + 30 * colSpacing + 70;
  const totalHeight = startY + 3 * rowHeight + 40;

  return `
    <svg class="peg-board-svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="100%" role="img" aria-label="Cribbage Peg Board. Seat A score: ${clampedA}, Seat B score: ${clampedB}">
      <rect x="10" y="10" width="${totalWidth - 20}" height="${totalHeight - 20}" rx="14" ry="14" fill="#1e293b" stroke="#334155" stroke-width="3"/>
      <text x="25" y="24" font-family="system-ui, sans-serif" font-size="12" font-weight="bold" fill="#eab308">Track A</text>
      <text x="90" y="24" font-family="system-ui, sans-serif" font-size="12" font-weight="bold" fill="#38bdf8">Track B</text>
      ${holesSvg}
      ${pegsSvg}
    </svg>
  `;
}

if (typeof module !== 'undefined') {
  module.exports = {
    renderCardSvg,
    renderPegBoardSvg
  };
}
