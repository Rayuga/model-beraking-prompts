// Unicode Grapheme Segmentation utilities
(function(window) {
  'use strict';

  let segmenter = null;
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    try {
      segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
    } catch (e) {
      segmenter = null;
    }
  }

  function getGraphemes(text) {
    if (!text) return [];
    if (segmenter) {
      const segments = segmenter.segment(text);
      const res = [];
      for (const seg of segments) {
        res.push(seg.segment);
      }
      return res;
    }
    const res = [];
    let i = 0;
    while (i < text.length) {
      const code = text.codePointAt(i);
      const char = String.fromCodePoint(code);
      res.push(char);
      i += char.length;
    }
    return res;
  }

  function getGraphemeOffsets(text) {
    if (!text) return [0];
    if (segmenter) {
      const segments = segmenter.segment(text);
      const offsets = [0];
      for (const seg of segments) {
        offsets.push(seg.index + seg.segment.length);
      }
      return offsets;
    }
    const offsets = [0];
    let i = 0;
    while (i < text.length) {
      const code = text.codePointAt(i);
      const char = String.fromCodePoint(code);
      i += char.length;
      offsets.push(i);
    }
    return offsets;
  }

  function prevGraphemeCol(text, col) {
    if (col <= 0) return 0;
    const offsets = getGraphemeOffsets(text);
    for (let i = offsets.length - 1; i >= 0; i--) {
      if (offsets[i] < col) {
        return offsets[i];
      }
    }
    return 0;
  }

  function nextGraphemeCol(text, col) {
    if (col >= text.length) return text.length;
    const offsets = getGraphemeOffsets(text);
    for (let i = 0; i < offsets.length; i++) {
      if (offsets[i] > col) {
        return offsets[i];
      }
    }
    return text.length;
  }

  function clampCol(text, col) {
    if (col <= 0) return 0;
    if (col >= text.length) return text.length;
    const offsets = getGraphemeOffsets(text);
    let closest = 0;
    let minDiff = Infinity;
    for (const off of offsets) {
      const diff = Math.abs(off - col);
      if (diff < minDiff) {
        minDiff = diff;
        closest = off;
      }
    }
    return closest;
  }

  const GraphemeUtils = {
    getGraphemes,
    getGraphemeOffsets,
    prevGraphemeCol,
    nextGraphemeCol,
    clampCol
  };

  if (typeof window !== 'undefined') window.GraphemeUtils = GraphemeUtils;
  if (typeof global !== 'undefined') global.GraphemeUtils = GraphemeUtils;
  if (typeof module !== 'undefined' && module.exports) module.exports = GraphemeUtils;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
