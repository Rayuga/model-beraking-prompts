(function (root) {
  'use strict';

  const cloneCarets = carets => carets.map(c => ({ anchor: c.anchor, head: c.head, goal: c.goal ?? null }));
  const ordered = caret => [Math.min(caret.anchor, caret.head), Math.max(caret.anchor, caret.head)];

  class EditorModel {
    constructor(text = '') {
      this.text = text;
      this.carets = [{ anchor: 0, head: 0, goal: null }];
      this.undoStack = [];
      this.redoStack = [];
      this.version = 0;
      this.typingRun = 0;
      this._lines();
    }

    _lines() {
      this.lines = this.text.split('\n');
      this.starts = [];
      let offset = 0;
      for (const line of this.lines) { this.starts.push(offset); offset += line.length + 1; }
    }

    snapshot() { return { text: this.text, carets: cloneCarets(this.carets) }; }
    restore(snapshot) { this.text = snapshot.text; this.carets = cloneCarets(snapshot.carets); this._lines(); this.version += 1; }
    sameCarets(a, b) { return a.length === b.length && a.every((c, i) => c.anchor === b[i].anchor && c.head === b[i].head); }
    breakTyping() { this.typingRun += 1; }

    commit(before, type = 'edit', merge = false) {
      const after = this.snapshot();
      const previous = this.undoStack[this.undoStack.length - 1];
      if (type !== 'typing') this.breakTyping();
      const canMerge = merge && previous?.type === type && previous.typingRun === this.typingRun &&
        Date.now() - previous.time < 1200 && this.sameCarets(previous.after.carets, before.carets);
      if (canMerge) {
        previous.after = after;
        previous.time = Date.now();
      } else {
        this.undoStack.push({ before, after, type, typingRun: this.typingRun, time: Date.now() });
      }
      this.redoStack = [];
      this.version += 1;
    }

    normalizedRanges() {
      const ranges = this.carets.map((c, index) => { const [start, end] = ordered(c); return { start, end, index }; })
        .sort((a, b) => a.start - b.start || a.end - b.end);
      const merged = [];
      for (const range of ranges) {
        const last = merged[merged.length - 1];
        if (last && range.start <= last.end) last.end = Math.max(last.end, range.end);
        else merged.push({ start: range.start, end: range.end });
      }
      return merged;
    }

    replaceRanges(replacement, type = 'edit', merge = false) {
      const before = this.snapshot();
      const ranges = this.normalizedRanges();
      let result = '';
      let source = 0;
      let output = 0;
      const next = [];
      for (const range of ranges) {
        const unchanged = this.text.slice(source, range.start);
        result += unchanged + replacement;
        output += unchanged.length + replacement.length;
        next.push({ anchor: output, head: output, goal: null });
        source = range.end;
      }
      result += this.text.slice(source);
      if (result === this.text && ranges.every(r => r.start === r.end) && !replacement) return false;
      this.text = result;
      this.carets = next;
      this._lines();
      this.commit(before, type, merge);
      return true;
    }

    insert(text, type = 'typing') {
      const replacing = this.carets.some(c => c.anchor !== c.head);
      const editType = type === 'typing' && replacing ? 'replace-selection' : type;
      return this.replaceRanges(text, editType, editType === 'typing');
    }

    delete(direction) {
      const before = this.snapshot();
      const expanded = this.carets.map(c => {
        if (c.anchor !== c.head) return c;
        if (direction < 0 && c.head > 0) return { anchor: c.head - 1, head: c.head };
        if (direction > 0 && c.head < this.text.length) return { anchor: c.head, head: c.head + 1 };
        return c;
      });
      this.carets = expanded;
      const changed = this.replaceRanges('', direction < 0 ? 'backspace' : 'delete', false);
      if (!changed) this.restore(before);
      return changed;
    }

    undo() {
      const entry = this.undoStack.pop();
      if (!entry) return false;
      this.restore(entry.before); this.redoStack.push(entry); return true;
    }
    redo() {
      const entry = this.redoStack.pop();
      if (!entry) return false;
      this.restore(entry.after); this.undoStack.push(entry); return true;
    }

    lineColumn(offset) {
      offset = Math.max(0, Math.min(this.text.length, offset));
      let low = 0, high = this.starts.length - 1;
      while (low <= high) {
        const mid = (low + high) >> 1;
        if (this.starts[mid] <= offset) low = mid + 1; else high = mid - 1;
      }
      const line = Math.max(0, high);
      return { line, column: offset - this.starts[line] };
    }
    offsetAt(line, column) {
      line = Math.max(0, Math.min(this.lines.length - 1, line));
      return this.starts[line] + Math.max(0, Math.min(this.lines[line].length, column));
    }

    move(kind, extend = false, byWord = false) {
      this.breakTyping();
      this.carets = this.carets.map(c => {
        let head = c.head;
        let goal = null;
        const [start, end] = ordered(c);
        if (!extend && c.anchor !== c.head && (kind === 'left' || kind === 'right')) head = kind === 'left' ? start : end;
        else if (kind === 'left') {
          if (byWord) { const before = this.text.slice(0, head); const match = before.match(/(?:\s+|\w+|[^\w\s]+)$/u); head -= match ? match[0].length : 0; }
          else head = Math.max(0, head - 1);
        } else if (kind === 'right') {
          if (byWord) { const match = this.text.slice(head).match(/^(?:\s+|\w+|[^\w\s]+)/u); head += match ? match[0].length : 0; }
          else head = Math.min(this.text.length, head + 1);
        } else {
          const pos = this.lineColumn(head);
          if (kind === 'home') head = this.starts[pos.line];
          if (kind === 'end') head = this.starts[pos.line] + this.lines[pos.line].length;
          if (kind === 'up' || kind === 'down') {
            goal = c.goal ?? pos.column;
            head = this.offsetAt(pos.line + (kind === 'up' ? -1 : 1), goal);
          }
        }
        return { anchor: extend ? c.anchor : head, head, goal };
      });
    }

    selectAll() { this.breakTyping(); this.carets = [{ anchor: 0, head: this.text.length, goal: null }]; }
    selectedText() { return this.normalizedRanges().filter(r => r.end > r.start).map(r => this.text.slice(r.start, r.end)).join('\n'); }

    replaceAll(find, replacement) {
      if (!find) return 0;
      const count = this.text.split(find).length - 1;
      if (!count) return 0;
      const before = this.snapshot();
      this.text = this.text.split(find).join(replacement);
      this.carets = [{ anchor: 0, head: 0, goal: null }];
      this._lines(); this.commit(before, 'replace-all', false); return count;
    }

    loadDraft(text) {
      if (text === this.text) return false;
      const before = this.snapshot();
      this.text = text; this.carets = [{ anchor: 0, head: 0, goal: null }];
      this._lines(); this.commit(before, 'restore', false); return true;
    }
  }

  class CanvasEditor {
    constructor(container, canvas, spacer, callbacks = {}) {
      this.container = container; this.canvas = canvas; this.spacer = spacer; this.callbacks = callbacks;
      this.ctx = canvas.getContext('2d'); this.model = new EditorModel();
      this.lineHeight = 20; this.gutter = 65; this.pad = 12; this.charWidth = 8.42;
      this.dragging = false; this.dragAnchor = 0; this.renderPending = false;
      this.bind(); new ResizeObserver(() => this.layout()).observe(container);
    }
    setText(text) { this.model = new EditorModel(text); this.layout(); this.changed(); }
    changed() { this.layout(); this.callbacks.onChange?.(this.model); }
    layout() {
      const width = Math.max(this.container.clientWidth, this.gutter + this.pad * 2 + Math.max(1, ...this.model.lines.map(l => l.length)) * this.charWidth);
      this.spacer.style.width = `${width}px`; this.spacer.style.height = `${this.model.lines.length * this.lineHeight + 16}px`;
      this.render();
    }
    render() {
      if (this.renderPending) return;
      this.renderPending = true;
      requestAnimationFrame(() => {
        this.renderPending = false;
        const dpr = devicePixelRatio || 1, w = this.container.clientWidth, h = this.container.clientHeight;
        this.canvas.width = w * dpr; this.canvas.height = h * dpr;
        this.canvas.style.width = `${w}px`; this.canvas.style.height = `${h}px`;
        this.canvas.style.left = `${this.container.scrollLeft}px`; this.canvas.style.top = `${this.container.scrollTop}px`;
        const ctx = this.ctx; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
        ctx.font = '13px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'; ctx.textBaseline = 'top';
        const first = Math.max(0, Math.floor(this.container.scrollTop / this.lineHeight));
        const last = Math.min(this.model.lines.length, first + Math.ceil(h / this.lineHeight) + 1);
        ctx.fillStyle = '#f5f6f7'; ctx.fillRect(0, 0, this.gutter - this.container.scrollLeft, h);
        for (const range of this.model.normalizedRanges()) {
          if (range.start === range.end) continue;
          const a = this.model.lineColumn(range.start), b = this.model.lineColumn(range.end);
          for (let line = Math.max(first, a.line); line <= Math.min(last - 1, b.line); line++) {
            const startCol = line === a.line ? a.column : 0;
            const endCol = line === b.line ? b.column : this.model.lines[line].length + (line < b.line ? 1 : 0);
            const x = this.gutter + this.pad + startCol * this.charWidth - this.container.scrollLeft;
            ctx.fillStyle = '#cfe3fb'; ctx.fillRect(x, line * this.lineHeight - this.container.scrollTop, Math.max(3, (endCol - startCol) * this.charWidth), this.lineHeight);
          }
        }
        for (let line = first; line < last; line++) {
          const y = line * this.lineHeight - this.container.scrollTop + 2;
          ctx.fillStyle = '#89939c'; ctx.textAlign = 'right'; ctx.fillText(String(line + 1), this.gutter - 12 - this.container.scrollLeft, y);
          ctx.fillStyle = '#27323b'; ctx.textAlign = 'left'; ctx.fillText(this.model.lines[line].replaceAll('\t', '    '), this.gutter + this.pad - this.container.scrollLeft, y);
        }
        if (document.activeElement === this.container) for (const caret of this.model.carets) {
          const pos = this.model.lineColumn(caret.head); if (pos.line < first || pos.line >= last) continue;
          const x = this.gutter + this.pad + pos.column * this.charWidth - this.container.scrollLeft;
          const y = pos.line * this.lineHeight - this.container.scrollTop;
          ctx.fillStyle = '#075f51'; ctx.fillRect(x, y + 1, 1.5, this.lineHeight - 2);
        }
      });
    }
    hit(clientX, clientY) {
      const rect = this.container.getBoundingClientRect();
      const x = clientX - rect.left + this.container.scrollLeft - this.gutter - this.pad;
      const y = clientY - rect.top + this.container.scrollTop;
      return this.model.offsetAt(Math.floor(y / this.lineHeight), Math.round(Math.max(0, x) / this.charWidth));
    }
    ensureVisible(offset = this.model.carets[0].head) {
      const pos = this.model.lineColumn(offset), top = pos.line * this.lineHeight, x = this.gutter + this.pad + pos.column * this.charWidth;
      if (top < this.container.scrollTop) this.container.scrollTop = top;
      if (top + this.lineHeight > this.container.scrollTop + this.container.clientHeight) this.container.scrollTop = top + this.lineHeight - this.container.clientHeight;
      if (x < this.container.scrollLeft + this.gutter) this.container.scrollLeft = Math.max(0, x - this.gutter);
      if (x + 15 > this.container.scrollLeft + this.container.clientWidth) this.container.scrollLeft = x + 15 - this.container.clientWidth;
      this.render();
    }
    selectWord(offset) {
      let start = offset, end = offset;
      const word = ch => /[\p{L}\p{N}_]/u.test(ch || '');
      while (start > 0 && word(this.model.text[start - 1])) start--;
      while (end < this.model.text.length && word(this.model.text[end])) end++;
      if (start === end) end = Math.min(this.model.text.length, end + 1);
      this.model.carets = [{ anchor: start, head: end, goal: null }];
    }
    bind() {
      this.container.addEventListener('scroll', () => this.render());
      this.container.addEventListener('focus', () => this.render()); this.container.addEventListener('blur', () => this.render());
      this.container.addEventListener('mousedown', event => {
        if (event.button !== 0) return; event.preventDefault(); this.container.focus();
        const offset = this.hit(event.clientX, event.clientY), additive = event.altKey || event.ctrlKey || event.metaKey;
        if (event.detail >= 3) {
          const p = this.model.lineColumn(offset), start = this.model.starts[p.line], end = start + this.model.lines[p.line].length + (p.line < this.model.lines.length - 1 ? 1 : 0);
          this.model.carets = [{ anchor: start, head: end, goal: null }];
        } else if (event.detail === 2) this.selectWord(offset);
        else if (event.shiftKey && !additive) this.model.carets[0].head = offset;
        else if (additive) this.model.carets.push({ anchor: offset, head: offset, goal: null });
        else this.model.carets = [{ anchor: offset, head: offset, goal: null }];
        this.model.breakTyping();
        this.dragging = true; this.dragAnchor = this.model.carets[this.model.carets.length - 1].anchor; this.changed();
      });
      window.addEventListener('mousemove', event => {
        if (!this.dragging) return;
        const rect = this.container.getBoundingClientRect();
        if (event.clientY < rect.top) this.container.scrollTop -= this.lineHeight;
        if (event.clientY > rect.bottom) this.container.scrollTop += this.lineHeight;
        if (event.clientX < rect.left + this.gutter) this.container.scrollLeft -= 20;
        if (event.clientX > rect.right) this.container.scrollLeft += 20;
        const caret = this.model.carets[this.model.carets.length - 1]; caret.anchor = this.dragAnchor; caret.head = this.hit(event.clientX, Math.max(rect.top, Math.min(rect.bottom - 1, event.clientY)));
        this.changed();
      });
      window.addEventListener('mouseup', () => { this.dragging = false; });
      this.container.addEventListener('copy', event => { const text = this.model.selectedText(); if (text) { event.clipboardData.setData('text/plain', text); event.preventDefault(); } });
      this.container.addEventListener('cut', event => { const text = this.model.selectedText(); if (text) { event.clipboardData.setData('text/plain', text); event.preventDefault(); this.model.replaceRanges('', 'cut'); this.changed(); } });
      this.container.addEventListener('paste', event => { event.preventDefault(); this.model.insert(event.clipboardData.getData('text/plain').replace(/\r\n?/g, '\n'), 'paste'); this.changed(); this.ensureVisible(); });
      this.container.addEventListener('keydown', event => this.keydown(event));
    }
    keydown(event) {
      const mod = event.ctrlKey || event.metaKey;
      if (mod && event.key.toLowerCase() === 'a') { event.preventDefault(); this.model.selectAll(); this.changed(); return; }
      if (mod && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? this.model.redo() : this.model.undo(); this.changed(); this.ensureVisible(); return; }
      if (mod && event.key.toLowerCase() === 'y') { event.preventDefault(); this.model.redo(); this.changed(); this.ensureVisible(); return; }
      if (mod && ['c', 'x', 'v'].includes(event.key.toLowerCase())) return;
      const moves = { ArrowLeft:'left', ArrowRight:'right', ArrowUp:'up', ArrowDown:'down', Home:'home', End:'end' };
      if (moves[event.key]) { event.preventDefault(); this.model.move(moves[event.key], event.shiftKey, mod); this.changed(); this.ensureVisible(); return; }
      if (event.key === 'Backspace' || event.key === 'Delete') { event.preventDefault(); this.model.delete(event.key === 'Backspace' ? -1 : 1); this.changed(); this.ensureVisible(); return; }
      if (event.key === 'Enter' || event.key === 'Tab' || (event.key.length === 1 && !mod && !event.altKey)) {
        event.preventDefault(); this.model.insert(event.key === 'Enter' ? '\n' : event.key === 'Tab' ? '\t' : event.key); this.changed(); this.ensureVisible();
      }
    }
  }

  root.PatchPadEditor = { EditorModel, CanvasEditor };
  if (typeof module !== 'undefined') module.exports = { EditorModel };
})(typeof window !== 'undefined' ? window : globalThis);
