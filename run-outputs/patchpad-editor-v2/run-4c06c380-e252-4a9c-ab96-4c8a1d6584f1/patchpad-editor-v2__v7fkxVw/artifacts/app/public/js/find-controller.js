// Find and Replace Controller
(function(window) {
  'use strict';

  class FindController {
    constructor() {
      this.query = '';
      this.replaceText = '';
      this.caseSensitive = false;
      this.useRegex = false;
      this.wholeWord = false;
      this.matches = [];
      this.currentMatchIndex = -1;
    }

    setQuery(query) {
      this.query = query || '';
    }

    setReplaceText(text) {
      this.replaceText = text || '';
    }

    findMatches(doc, currentCaret = null) {
      this.matches = [];
      this.currentMatchIndex = -1;

      if (!this.query || !doc) {
        return { count: 0, currentIndex: -1, currentMatch: null };
      }

      let regex;
      try {
        let pattern = this.query;
        if (!this.useRegex) {
          // Escape regex special chars
          pattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }
        if (this.wholeWord) {
          pattern = `\\b${pattern}\\b`;
        }
        const flags = this.caseSensitive ? 'g' : 'gi';
        regex = new RegExp(pattern, flags);
      } catch (e) {
        return { count: 0, currentIndex: -1, currentMatch: null, error: e.message };
      }

      for (let r = 0; r < doc.lineCount; r++) {
        const line = doc.getLine(r);
        let match;
        regex.lastIndex = 0;
        while ((match = regex.exec(line)) !== null) {
          const matchLength = match[0].length;
          if (matchLength === 0) {
            regex.lastIndex++;
            continue;
          }
          this.matches.push({
            row: r,
            startCol: match.index,
            endCol: match.index + matchLength,
            text: match[0],
            index: this.matches.length
          });
        }
      }

      // Determine initial active match based on caret position
      if (this.matches.length > 0) {
        if (currentCaret) {
          let foundIndex = -1;
          for (let i = 0; i < this.matches.length; i++) {
            const m = this.matches[i];
            if (m.row > currentCaret.row || (m.row === currentCaret.row && m.startCol >= currentCaret.col)) {
              foundIndex = i;
              break;
            }
          }
          this.currentMatchIndex = foundIndex >= 0 ? foundIndex : 0;
        } else {
          this.currentMatchIndex = 0;
        }
      }

      const currentMatch = this.currentMatchIndex >= 0 ? this.matches[this.currentMatchIndex] : null;
      return {
        count: this.matches.length,
        currentIndex: this.currentMatchIndex,
        currentMatch
      };
    }

    nextMatch() {
      if (this.matches.length === 0) return null;
      this.currentMatchIndex = (this.currentMatchIndex + 1) % this.matches.length;
      return this.matches[this.currentMatchIndex];
    }

    prevMatch() {
      if (this.matches.length === 0) return null;
      this.currentMatchIndex = (this.currentMatchIndex - 1 + this.matches.length) % this.matches.length;
      return this.matches[this.currentMatchIndex];
    }

    getCurrentMatch() {
      if (this.currentMatchIndex >= 0 && this.currentMatchIndex < this.matches.length) {
        return this.matches[this.currentMatchIndex];
      }
      return null;
    }
  }

  if (typeof window !== 'undefined') window.FindController = FindController;
  if (typeof global !== 'undefined') global.FindController = FindController;
  if (typeof module !== 'undefined' && module.exports) module.exports = FindController;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
