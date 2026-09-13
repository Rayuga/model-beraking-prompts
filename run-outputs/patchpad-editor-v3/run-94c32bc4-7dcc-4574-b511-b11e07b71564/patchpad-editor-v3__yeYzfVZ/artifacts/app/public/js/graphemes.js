// Grapheme cluster and Unicode utilities for PatchPad

const segmenter = (typeof Intl !== 'undefined' && Intl.Segmenter)
  ? new Intl.Segmenter('en', { granularity: 'grapheme' })
  : null;

/**
 * Returns an array of grapheme segments for a string
 * @param {string} str 
 * @returns {Array<{ segment: string, index: number }>}
 */
function getGraphemeSegments(str) {
  if (!str) return [];
  if (segmenter) {
    return Array.from(segmenter.segment(str));
  }
  // Fallback for environments without Intl.Segmenter
  const segments = [];
  let index = 0;
  for (const ch of str) {
    segments.push({ segment: ch, index });
    index += ch.length;
  }
  return segments;
}

/**
 * Get the previous grapheme cluster boundary before the given character column
 * @param {string} str 
 * @param {number} col 
 * @returns {number}
 */
function prevGraphemeBoundary(str, col) {
  if (col <= 0) return 0;
  if (col > str.length) col = str.length;
  const segs = getGraphemeSegments(str);
  let prevIndex = 0;
  for (const s of segs) {
    if (s.index >= col) {
      return prevIndex;
    }
    prevIndex = s.index;
  }
  return prevIndex;
}

/**
 * Get the next grapheme cluster boundary after the given character column
 * @param {string} str 
 * @param {number} col 
 * @returns {number}
 */
function nextGraphemeBoundary(str, col) {
  if (col < 0) col = 0;
  if (col >= str.length) return str.length;
  const segs = getGraphemeSegments(str);
  for (const s of segs) {
    if (s.index > col) {
      return s.index;
    }
  }
  return str.length;
}

/**
 * Check if a character is a word character
 * @param {string} char 
 * @returns {boolean}
 */
function isWordChar(char) {
  if (!char) return false;
  return /[\p{L}\p{N}_]/u.test(char);
}

/**
 * Check if a character is whitespace
 * @param {string} char 
 * @returns {boolean}
 */
function isWhitespace(char) {
  return char === ' ' || char === '\t' || char === '\n' || char === '\r';
}

/**
 * Find the previous word boundary before `col`
 * @param {string} str 
 * @param {number} col 
 * @returns {number}
 */
function prevWordBoundary(str, col) {
  if (col <= 0) return 0;
  let pos = col;

  // If pos is inside or at the end of whitespace, skip whitespace backwards
  while (pos > 0 && isWhitespace(str[pos - 1])) {
    pos = prevGraphemeBoundary(str, pos);
  }

  if (pos <= 0) return 0;

  // Determine type of character preceding pos
  const prevChar = str[pos - 1];
  const lookingForWord = isWordChar(prevChar);

  if (lookingForWord) {
    while (pos > 0 && isWordChar(str[pos - 1])) {
      pos = prevGraphemeBoundary(str, pos);
    }
  } else {
    // Non-word punctuation
    while (pos > 0 && !isWordChar(str[pos - 1]) && !isWhitespace(str[pos - 1])) {
      pos = prevGraphemeBoundary(str, pos);
    }
  }

  return pos;
}

/**
 * Find the next word boundary after `col`
 * @param {string} str 
 * @param {number} col 
 * @returns {number}
 */
function nextWordBoundary(str, col) {
  const len = str.length;
  if (col >= len) return len;
  let pos = col;

  const currChar = str[pos];
  if (isWhitespace(currChar)) {
    // Skip whitespace forward
    while (pos < len && isWhitespace(str[pos])) {
      pos = nextGraphemeBoundary(str, pos);
    }
  } else if (isWordChar(currChar)) {
    // Advance across word chars
    while (pos < len && isWordChar(str[pos])) {
      pos = nextGraphemeBoundary(str, pos);
    }
  } else {
    // Advance across punctuation
    while (pos < len && !isWordChar(str[pos]) && !isWhitespace(str[pos])) {
      pos = nextGraphemeBoundary(str, pos);
    }
  }

  return pos;
}

// Export for browser & node
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getGraphemeSegments,
    prevGraphemeBoundary,
    nextGraphemeBoundary,
    isWordChar,
    isWhitespace,
    prevWordBoundary,
    nextWordBoundary
  };
}
