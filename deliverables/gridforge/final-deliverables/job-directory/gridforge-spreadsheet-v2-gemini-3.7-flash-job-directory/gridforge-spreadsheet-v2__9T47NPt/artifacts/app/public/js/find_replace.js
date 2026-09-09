/**
 * GridForge Find & Replace Engine
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FindReplaceEngine = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  class FindReplace {
    constructor(calculator) {
      this.calculator = calculator;
      this.matches = [];
      this.currentIndex = -1;
    }

    findAll(query, options = {}) {
      this.matches = [];
      this.currentIndex = -1;

      if (!query || query.trim() === '') {
        return this.matches;
      }

      const matchCase = !!options.matchCase;
      const entireCell = !!options.entireCell;
      const searchQuery = matchCase ? query : query.toLowerCase();

      const rawCells = this.calculator.rawCells;
      // Sort cell keys logically (Row-by-row: A1, B1, C1... A2, B2, C2...)
      const cellKeys = Object.keys(rawCells).sort((a, b) => {
        const pA = a.match(/^([A-Z]+)([0-9]+)$/);
        const pB = b.match(/^([A-Z]+)([0-9]+)$/);
        if (pA && pB) {
          const rA = parseInt(pA[2], 10), rB = parseInt(pB[2], 10);
          if (rA !== rB) return rA - rB;
          return pA[1].localeCompare(pB[1]);
        }
        return a.localeCompare(b);
      });

      for (const ref of cellKeys) {
        const raw = String(rawCells[ref] || '');
        const display = String(this.calculator.getDisplayValue(ref) || '');

        const targetRaw = matchCase ? raw : raw.toLowerCase();
        const targetDisplay = matchCase ? display : display.toLowerCase();

        let matched = false;
        if (entireCell) {
          if (targetRaw === searchQuery || targetDisplay === searchQuery) {
            matched = true;
          }
        } else {
          if (targetRaw.includes(searchQuery) || targetDisplay.includes(searchQuery)) {
            matched = true;
          }
        }

        if (matched) {
          this.matches.push(ref);
        }
      }

      if (this.matches.length > 0) {
        this.currentIndex = 0;
      }

      return this.matches;
    }

    next() {
      if (this.matches.length === 0) return null;
      this.currentIndex = (this.currentIndex + 1) % this.matches.length;
      return this.matches[this.currentIndex];
    }

    prev() {
      if (this.matches.length === 0) return null;
      this.currentIndex = (this.currentIndex - 1 + this.matches.length) % this.matches.length;
      return this.matches[this.currentIndex];
    }

    current() {
      if (this.currentIndex >= 0 && this.currentIndex < this.matches.length) {
        return this.matches[this.currentIndex];
      }
      return null;
    }

    replaceAll(query, replacement, options = {}) {
      if (!query) return [];
      const matchCase = !!options.matchCase;
      const entireCell = !!options.entireCell;

      const matches = this.findAll(query, options);
      const changes = [];

      for (const ref of matches) {
        const oldVal = String(this.calculator.getRawValue(ref) || '');
        let newVal = '';

        if (entireCell) {
          newVal = replacement;
        } else {
          const flags = matchCase ? 'g' : 'gi';
          // Escape regex special chars in query
          const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(escaped, flags);
          newVal = oldVal.replace(regex, replacement);
        }

        if (oldVal !== newVal) {
          changes.push({ cell: ref, oldVal, newVal });
        }
      }

      return changes;
    }
  }

  return { FindReplace };
});
