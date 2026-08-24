(() => {
  const LINE_HEIGHT = 21;
  const GUTTER = 76;

  class PatchEditor {
    constructor(root, options = {}) {
      this.root = root;
      this.spacer = root.querySelector('#editor-spacer');
      this.layer = root.querySelector('#editor-lines');
      this.text = '';
      this.lines = [''];
      this.starts = [0];
      this.ranges = [{ anchor: 0, head: 0 }];
      this.undoStack = [];
      this.redoStack = [];
      this.readOnly = false;
      this.onChange = options.onChange || (() => {});
      this.onCursor = options.onCursor || (() => {});
      this.dragging = false;
      this.measure = document.createElement('canvas').getContext('2d');
      this.measure.font = getComputedStyle(root).font;
      this.charWidth = this.measure.measureText('M').width;
      this.bind();
    }

    bind() {
      this.root.addEventListener('scroll', () => this.render());
      this.root.addEventListener('keydown', event => this.keydown(event));
      this.root.addEventListener('copy', event => this.copy(event));
      this.root.addEventListener('cut', event => this.cut(event));
      this.root.addEventListener('paste', event => this.paste(event));
      this.root.addEventListener('pointerdown', event => this.pointerDown(event));
      window.addEventListener('pointermove', event => this.pointerMove(event));
      window.addEventListener('pointerup', () => this.pointerUp());
      this.root.addEventListener('focus', () => this.render());
      this.root.addEventListener('blur', () => this.render());
    }

    setText(text, options = {}) {
      this.text = String(text).replace(/\r\n?/g, '\n');
      this.reindex();
      this.ranges = [{ anchor: 0, head: 0 }];
      if (options.clearHistory !== false) {
        this.undoStack = [];
        this.redoStack = [];
      }
      this.root.scrollTop = 0;
      this.root.scrollLeft = 0;
      this.render();
      this.notifyCursor();
      if (!options.silent) this.onChange(this.text);
    }

    getText() { return this.text; }
    getSelection() { return { ...this.ranges[0] }; }
    canUndo() { return this.undoStack.length > 0; }
    canRedo() { return this.redoStack.length > 0; }

    reindex() {
      this.lines = this.text.split('\n');
      this.starts = new Array(this.lines.length);
      let offset = 0;
      let maxVisual = 1;
      for (let i = 0; i < this.lines.length; i += 1) {
        this.starts[i] = offset;
        offset += this.lines[i].length + 1;
        maxVisual = Math.max(maxVisual, this.visualColumn(this.lines[i]));
      }
      this.spacer.style.height = `${this.lines.length * LINE_HEIGHT}px`;
      this.spacer.style.width = `${GUTTER + maxVisual * this.charWidth + 30}px`;
    }

    position(offset) {
      offset = Math.max(0, Math.min(this.text.length, offset));
      let lo = 0, hi = this.starts.length - 1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (this.starts[mid] <= offset) lo = mid + 1;
        else hi = mid - 1;
      }
      const line = Math.max(0, hi);
      return { line, column: Math.min(offset - this.starts[line], this.lines[line].length) };
    }

    offset(line, column) {
      line = Math.max(0, Math.min(this.lines.length - 1, line));
      return this.starts[line] + Math.max(0, Math.min(this.lines[line].length, column));
    }

    visualColumn(value, end = value.length) {
      let visual = 0;
      for (let i = 0; i < end; i += 1) visual += value[i] === '\t' ? 4 - (visual % 4) : 1;
      return visual;
    }

    columnFromVisual(value, target) {
      let visual = 0;
      for (let i = 0; i < value.length; i += 1) {
        const next = visual + (value[i] === '\t' ? 4 - (visual % 4) : 1);
        if (target < (visual + next) / 2) return i;
        visual = next;
      }
      return value.length;
    }

    render() {
      const first = Math.max(0, Math.floor(this.root.scrollTop / LINE_HEIGHT) - 2);
      const last = Math.min(this.lines.length, Math.ceil((this.root.scrollTop + this.root.clientHeight) / LINE_HEIGHT) + 2);
      this.layer.replaceChildren();
      const fragment = document.createDocumentFragment();
      for (let line = first; line < last; line += 1) {
        const row = document.createElement('div');
        row.className = 'editor-line';
        row.style.top = `${line * LINE_HEIGHT}px`;
        const number = document.createElement('span');
        number.className = 'line-number';
        number.textContent = String(line + 1);
        const content = document.createElement('span');
        content.className = 'line-content';
        content.textContent = this.lines[line] || ' ';
        this.paintRanges(content, line);
        row.append(number, content);
        fragment.append(row);
      }
      this.layer.append(fragment);
    }

    paintRanges(content, line) {
      const lineStart = this.starts[line];
      const lineEnd = lineStart + this.lines[line].length;
      for (const range of this.ranges) {
        const start = Math.min(range.anchor, range.head);
        const end = Math.max(range.anchor, range.head);
        if (end > lineStart && start <= lineEnd) {
          const from = Math.max(start, lineStart) - lineStart;
          let to = Math.min(end, lineEnd) - lineStart;
          if (end > lineEnd && line < this.lines.length - 1) to += 1;
          const mark = document.createElement('span');
          mark.className = 'selection';
          mark.style.left = `${this.visualColumn(this.lines[line], from) * this.charWidth}px`;
          mark.style.width = `${Math.max(4, (this.visualColumn(this.lines[line], Math.min(to, this.lines[line].length)) - this.visualColumn(this.lines[line], from)) * this.charWidth + (to > this.lines[line].length ? this.charWidth : 0))}px`;
          content.prepend(mark);
        }
        if (range.anchor === range.head) {
          const pos = this.position(range.head);
          if (pos.line === line) {
            const caret = document.createElement('span');
            caret.className = 'caret';
            caret.style.left = `${this.visualColumn(this.lines[line], pos.column) * this.charWidth}px`;
            content.append(caret);
          }
        }
      }
    }

    snapshot() { return { text: this.text, ranges: this.ranges.map(range => ({ ...range })) }; }
    restore(snapshot) {
      this.text = snapshot.text;
      this.ranges = snapshot.ranges.map(range => ({ ...range }));
      this.reindex(); this.render(); this.ensureVisible(); this.onChange(this.text); this.notifyCursor();
    }
    undo() {
      if (!this.canUndo() || this.readOnly) return;
      this.redoStack.push(this.snapshot());
      this.restore(this.undoStack.pop());
    }
    redo() {
      if (!this.canRedo() || this.readOnly) return;
      this.undoStack.push(this.snapshot());
      this.restore(this.redoStack.pop());
    }

    edit(insert, mode = 'selection') {
      if (this.readOnly) return;
      const edits = this.ranges.map(range => {
        let start = Math.min(range.anchor, range.head), end = Math.max(range.anchor, range.head);
        if (start === end && mode === 'backspace' && start > 0) start -= 1;
        if (start === end && mode === 'delete' && end < this.text.length) end += 1;
        return { start, end, insert };
      }).sort((a, b) => a.start - b.start || a.end - b.end);
      const merged = [];
      for (const edit of edits) {
        const previous = merged.at(-1);
        if (previous && edit.start <= previous.end) previous.end = Math.max(previous.end, edit.end);
        else merged.push({ ...edit });
      }
      if (merged.every(edit => edit.start === edit.end && !edit.insert)) return;
      this.undoStack.push(this.snapshot());
      if (this.undoStack.length > 200) this.undoStack.shift();
      this.redoStack = [];
      let output = '', cursor = 0;
      const newRanges = [];
      for (const item of merged) {
        output += this.text.slice(cursor, item.start) + item.insert;
        const head = output.length;
        newRanges.push({ anchor: head, head });
        cursor = item.end;
      }
      this.text = output + this.text.slice(cursor);
      this.ranges = newRanges;
      this.reindex(); this.render(); this.ensureVisible(); this.onChange(this.text); this.notifyCursor();
    }

    replaceRanges(ranges, insert) {
      this.ranges = ranges.map(({ start, end }) => ({ anchor: start, head: end }));
      this.edit(insert);
    }

    setSelection(anchor, head = anchor, additive = false) {
      const range = { anchor: Math.max(0, Math.min(this.text.length, anchor)), head: Math.max(0, Math.min(this.text.length, head)) };
      this.ranges = additive ? [...this.ranges, range] : [range];
      this.dedupeCarets(); this.render(); this.ensureVisible(); this.notifyCursor();
    }

    dedupeCarets() {
      const seen = new Set();
      this.ranges = this.ranges.filter(range => {
        const key = `${range.anchor}:${range.head}`;
        if (seen.has(key)) return false;
        seen.add(key); return true;
      });
    }

    move(kind, extend) {
      this.ranges = this.ranges.map(range => {
        let head = range.head;
        const start = Math.min(range.anchor, range.head), end = Math.max(range.anchor, range.head);
        if (!extend && start !== end && (kind === 'left' || kind === 'right')) head = kind === 'left' ? start : end;
        else {
          const pos = this.position(head);
          if (kind === 'left') head = Math.max(0, head - 1);
          if (kind === 'right') head = Math.min(this.text.length, head + 1);
          if (kind === 'home') head = this.starts[pos.line];
          if (kind === 'end') head = this.starts[pos.line] + this.lines[pos.line].length;
          if (kind === 'up' || kind === 'down') {
            const goal = range.goal ?? this.visualColumn(this.lines[pos.line], pos.column);
            const target = pos.line + (kind === 'up' ? -1 : 1);
            head = this.offset(target, this.columnFromVisual(this.lines[Math.max(0, Math.min(this.lines.length - 1, target))], goal));
            range.goal = goal;
          } else delete range.goal;
        }
        return { anchor: extend ? range.anchor : head, head, goal: range.goal };
      });
      this.dedupeCarets(); this.render(); this.ensureVisible(); this.notifyCursor();
    }

    keydown(event) {
      if (this.readOnly) return;
      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (mod && key === 'a') { event.preventDefault(); this.setSelection(0, this.text.length); return; }
      if (mod && key === 'z') { event.preventDefault(); event.shiftKey ? this.redo() : this.undo(); return; }
      if ((mod && key === 'y')) { event.preventDefault(); this.redo(); return; }
      if (mod && ['c', 'x', 'v', 'f', 's'].includes(key)) return;
      const moves = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', Home: 'home', End: 'end' };
      if (moves[event.key]) { event.preventDefault(); this.move(moves[event.key], event.shiftKey); return; }
      if (event.key === 'Backspace') { event.preventDefault(); this.edit('', 'backspace'); return; }
      if (event.key === 'Delete') { event.preventDefault(); this.edit('', 'delete'); return; }
      if (event.key === 'Enter') { event.preventDefault(); this.edit('\n'); return; }
      if (event.key === 'Tab') { event.preventDefault(); this.edit('\t'); return; }
      if (!mod && !event.altKey && event.key.length === 1) { event.preventDefault(); this.edit(event.key); }
    }

    selectedTexts() {
      return this.ranges.filter(r => r.anchor !== r.head).map(r => this.text.slice(Math.min(r.anchor, r.head), Math.max(r.anchor, r.head)));
    }
    copy(event) {
      const values = this.selectedTexts();
      if (!values.length) return;
      event.preventDefault(); event.clipboardData.setData('text/plain', values.join('\n'));
    }
    cut(event) {
      if (this.readOnly) return;
      const values = this.selectedTexts();
      if (!values.length) return;
      event.preventDefault(); event.clipboardData.setData('text/plain', values.join('\n')); this.edit('');
    }
    paste(event) {
      if (this.readOnly) return;
      event.preventDefault(); this.edit(event.clipboardData.getData('text/plain').replace(/\r\n?/g, '\n'));
    }

    pointOffset(event) {
      const rect = this.root.getBoundingClientRect();
      const y = event.clientY - rect.top + this.root.scrollTop;
      const x = event.clientX - rect.left + this.root.scrollLeft - GUTTER;
      const line = Math.max(0, Math.min(this.lines.length - 1, Math.floor(y / LINE_HEIGHT)));
      return this.offset(line, this.columnFromVisual(this.lines[line], Math.max(0, x / this.charWidth)));
    }
    pointerDown(event) {
      if (event.button !== 0 || this.readOnly) return;
      event.preventDefault(); this.root.focus();
      const offset = this.pointOffset(event);
      const additive = event.altKey || event.ctrlKey || event.metaKey;
      if (event.detail >= 3) {
        const pos = this.position(offset), start = this.starts[pos.line];
        const end = pos.line < this.lines.length - 1 ? this.starts[pos.line + 1] : this.text.length;
        this.setSelection(start, end, additive);
      } else if (event.detail === 2) {
        let start = offset, end = offset;
        const word = /[\p{L}\p{N}_]/u;
        while (start > 0 && word.test(this.text[start - 1])) start -= 1;
        while (end < this.text.length && word.test(this.text[end])) end += 1;
        this.setSelection(start, end, additive);
      } else if (event.shiftKey && !additive) {
        this.setSelection(this.ranges[0].anchor, offset);
      } else this.setSelection(offset, offset, additive);
      this.dragging = true;
      this.dragAnchor = this.ranges.at(-1).anchor;
      this.dragIndex = this.ranges.length - 1;
    }
    pointerMove(event) {
      if (!this.dragging) return;
      const rect = this.root.getBoundingClientRect();
      if (event.clientY < rect.top) this.root.scrollTop -= Math.max(8, rect.top - event.clientY);
      if (event.clientY > rect.bottom) this.root.scrollTop += Math.max(8, event.clientY - rect.bottom);
      const head = this.pointOffset(event);
      this.ranges[this.dragIndex] = { anchor: this.dragAnchor, head };
      this.render(); this.notifyCursor();
    }
    pointerUp() { this.dragging = false; }

    ensureVisible() {
      const pos = this.position(this.ranges[0].head);
      const top = pos.line * LINE_HEIGHT, bottom = top + LINE_HEIGHT;
      if (top < this.root.scrollTop) this.root.scrollTop = top;
      if (bottom > this.root.scrollTop + this.root.clientHeight) this.root.scrollTop = bottom - this.root.clientHeight;
      const x = GUTTER + this.visualColumn(this.lines[pos.line], pos.column) * this.charWidth;
      if (x < this.root.scrollLeft + GUTTER) this.root.scrollLeft = Math.max(0, x - GUTTER);
      if (x > this.root.scrollLeft + this.root.clientWidth - 20) this.root.scrollLeft = x - this.root.clientWidth + 20;
    }
    notifyCursor() {
      const pos = this.position(this.ranges[0].head);
      this.onCursor({ line: pos.line + 1, column: pos.column + 1, carets: this.ranges.length });
    }
  }

  window.PatchEditor = PatchEditor;
})();
