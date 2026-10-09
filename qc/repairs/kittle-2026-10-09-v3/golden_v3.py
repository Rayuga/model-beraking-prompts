"""v3 golden: delete confirmation, kept highlight, Enter/Shift+Enter/Escape, @ suggestions,
and the search box placeholder that clipped at phone width. Run from the task's solution/app/public."""


def edit(p, pairs):
    s = open(p, encoding='utf8').read()
    for a, b in pairs:
        assert s.count(a) == 1, (p, a[:80])
        s = s.replace(a, b)
    open(p, 'w', encoding='utf8', newline='').write(s)


SUGGEST = r'''$("composer-input").addEventListener("input", () => { hideError("composer-error"); suggestMentions(); });
$("composer-input").addEventListener("click", suggestMentions);
// Enter sends, Shift+Enter is a new line, Escape closes an edit or reply without saving.
$("composer-input").addEventListener("keydown", event => {
  if (event.isComposing) return;
  const open = !$("mention-suggest").hidden;
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    if (open && state.suggestions.length) return pickMention(state.suggestions[0]);
    $("composer").requestSubmit();
  } else if (event.key === "Escape") {
    if (open) { event.preventDefault(); return hideSuggestions(); }
    if (state.editing || state.replyTo) { event.preventDefault(); resetComposer(); }
  }
});

/* ---------- mention suggestions ---------- */

// The @word being typed just before the caret, if any.
function mentionToken() {
  const input = $("composer-input");
  const before = input.value.slice(0, input.selectionStart);
  const m = before.match(/(^|[^\w@])@([^\s@]*)$/);
  return m ? { start: before.length - m[2].length - 1, query: m[2].toLowerCase() } : null;
}
let suggestSeq = 0;
async function suggestMentions() {
  const token = mentionToken();
  if (!token || !state.current) return hideSuggestions();
  const seq = ++suggestSeq;
  const r = await api(`/api/matters/${encodeURIComponent(state.current)}/people`);
  if (seq !== suggestSeq) return;
  if (!r.ok) return hideSuggestions();
  state.suggestions = r.data.people.filter(p => p.name.toLowerCase().split(" ").some(w => w.startsWith(token.query)));
  const list = $("mention-suggest");
  list.innerHTML = "";
  for (const p of state.suggestions) {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button"; b.className = "suggestion"; b.setAttribute("role", "option");
    b.textContent = p.name;
    b.addEventListener("mousedown", e => e.preventDefault());
    b.addEventListener("click", () => pickMention(p));
    li.appendChild(b);
    list.appendChild(li);
  }
  list.hidden = !state.suggestions.length;
}
function pickMention(p) {
  const input = $("composer-input");
  const token = mentionToken();
  if (!token) return hideSuggestions();
  const end = input.selectionStart;
  input.value = input.value.slice(0, token.start) + "@" + p.mention + " " + input.value.slice(end);
  const caret = token.start + p.mention.length + 2;
  input.setSelectionRange(caret, caret);
  input.focus();
  hideSuggestions();
}
function hideSuggestions() {
  suggestSeq++;
  state.suggestions = [];
  $("mention-suggest").hidden = true;
  $("mention-suggest").innerHTML = "";
}'''

edit('app.js', [
    ('threadSig: "", listSig: "", messageErrors: {}\n};',
     'threadSig: "", listSig: "", messageErrors: {},\n  confirmDelete: null, suggestions: []\n};'),
    # the highlight survives live re-renders
    ('  li.className = "message" + (msg.depth ? " reply" : "") + (msg.deleted ? " deleted" : "");',
     '  li.className = "message" + (msg.depth ? " reply" : "") + (msg.deleted ? " deleted" : "") + (state.focusMessage === msg.id ? " focused" : "");'),
    # delete asks first
    ('  add("Reply", () => startReply(msg), `Reply to ${msg.author_name}`);\n  if (msg.mine) { add("Edit", () => startEdit(msg)); add("Delete", () => deleteMessage(msg)); }',
     '  if (state.confirmDelete === msg.id) {\n'
     '    const ask = document.createElement("span");\n'
     '    ask.className = "confirm-text";\n'
     '    ask.textContent = "Delete this message? This can\'t be undone.";\n'
     '    actions.appendChild(ask);\n'
     '    add("Yes, delete", () => deleteMessage(msg));\n'
     '    add("Keep it", () => askDelete(msg, false));\n'
     '    actions.classList.add("confirming");\n'
     '  } else {\n'
     '  add("Reply", () => startReply(msg), `Reply to ${msg.author_name}`);\n'
     '  if (msg.mine) { add("Edit", () => startEdit(msg)); add("Delete", () => askDelete(msg, true)); }'),
    ('  if (state.me.role === "partner") add(msg.hold ? "Release hold" : "Place hold", () => setHold(msg, !msg.hold));\n  li.appendChild(actions);',
     '  if (state.me.role === "partner") add(msg.hold ? "Release hold" : "Place hold", () => setHold(msg, !msg.hold));\n  }\n  li.appendChild(actions);'),
    ('async function deleteMessage(msg) {\n  clearMessageError(msg);\n',
     'function askDelete(msg, asking) {\n'
     '  clearMessageError(msg);\n'
     '  state.confirmDelete = asking ? msg.id : null;\n'
     '  document.getElementById("msg-" + msg.id)?.replaceWith(renderMessage(msg));\n'
     '}\n'
     'async function deleteMessage(msg) {\n'
     '  clearMessageError(msg);\n'
     '  state.confirmDelete = null;\n'),
    ('  if (!r.ok) return messageError(msg, r.data.error || "That message can\'t be deleted.");\n  reloadCurrent();',
     '  if (!r.ok) {\n'
     '    document.getElementById("msg-" + msg.id)?.replaceWith(renderMessage(msg));\n'
     '    return messageError(msg, r.data.error || "That message can\'t be deleted.");\n'
     '  }\n'
     '  reloadCurrent();'),
    ('$("composer-input").addEventListener("input", () => hideError("composer-error"));\n'
     '$("composer-input").addEventListener("keydown", event => {\n'
     '  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); $("composer").requestSubmit(); }\n'
     '});', SUGGEST),
    ('function resetComposer() {\n  state.replyTo = null;',
     'function resetComposer() {\n  hideSuggestions();\n  state.replyTo = null;'),
    # leaving a matter drops any half-asked delete
    ('  if (switching) { resetComposer(); state.threadSig = ""; }',
     '  if (switching) { resetComposer(); state.threadSig = ""; state.confirmDelete = null; }'),
])

edit('index.html', [
    ('<input id="search-input" type="search" placeholder="Search messages">',
     '<input id="search-input" type="search" placeholder="Search">'),
    ('          <textarea id="composer-input" rows="3" placeholder="Write a message"></textarea>',
     '          <textarea id="composer-input" rows="3" placeholder="Write a message (Enter sends, Shift+Enter for a new line)"></textarea>\n'
     '          <ul id="mention-suggest" class="mention-suggest" role="listbox" aria-label="People who can see this matter" hidden></ul>'),
])

edit('styles.css', [
    ('.actions button { font-size: 13px; }',
     '.actions button { font-size: 13px; }\n'
     '.actions.confirming { align-items: center; background: #fbf1ee; border-radius: 6px; padding: 2px 6px; }\n'
     '.confirm-text { font-size: 13px; color: #a12a1b; font-weight: 600; margin-right: 4px; }'),
    ('.message.focused { box-shadow: 0 0 0 3px #f2c94c; }',
     '.message.focused { box-shadow: 0 0 0 3px #f2c94c; background: #fffbea; }'),
    ('.composer textarea { width: 100%; resize: vertical; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; }',
     '.composer textarea { width: 100%; resize: vertical; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; }\n'
     '.mention-suggest { list-style: none; margin: 0; padding: 4px; display: flex; flex-wrap: wrap; gap: 4px; border: 1px solid var(--line); border-radius: 8px; background: #f7f8fb; }\n'
     '.mention-suggest .suggestion { font-size: 13px; padding: 3px 10px; border-radius: 14px; }'),
    ('.search input { padding: 6px 8px; border-radius: 6px; border: 1px solid transparent; width: 220px; max-width: 46vw; }',
     '.search input { padding: 6px 8px; border-radius: 6px; border: 1px solid transparent; width: 220px; max-width: 46vw; text-overflow: ellipsis; }'),
])
print('ok')
