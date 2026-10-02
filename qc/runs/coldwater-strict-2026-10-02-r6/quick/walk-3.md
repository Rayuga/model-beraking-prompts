# Walk 3: run/console criteria vs golden (static trace, r6 frozen task)

Scope: cw_html_preview, cw_error_message_and_line, cw_promise_rejection_message_and_line,
cw_output_before_failure_kept, cw_run_starts_fresh_document, cw_console_levels_in_order,
cw_interaction_starts_fresh_budget.

Evidence type: source trace only (runtime.ts, app.tsx run/stop/log/status, runner.html, server.js CSP and listen lines).
Nothing was executed in a browser.

## Problems found: 0

No GOLDEN FAILS, NOT ACHIEVABLE or AMBIGUOUS finding in these seven criteria.

## Traces (drafts a judge would plausibly type, and what the golden shows)

### cw_error_message_and_line
- JS, `throw new Error("BOOM-417")` on line 4. Instrumentation inserts on the same line only (runtime.ts:46-48), script has
  line offset 0 (325), stack frame `cw-user-0-snippet.js:4:c` matches `sourceLine` (113). Console entry: `BOOM-417 · line 4` (403).
  Same result when the throw sits in a function declared on lines 3-5 and called later (first user frame is line 4).
- HTML, `<script>` on line 6 and throw on line 8. `locatedHtml` records the end of the open tag (306), `sourceLine(at)` gives 5 (322, 330),
  the script is padded with 5 newlines (357), so the stack and the `origin` line (48) both give 8. Entry: `HTML-BOOM · line 8`.
  A one-line `<script>throw ...</script>` on line 7 gives 7. Counted from the file, not the script block.
- Syntax error (`const list = [1, 2, 3;` + second line): acorn throws in `buildRun`, caught in `run` (386).
  Entry: `Unexpected token (1:21) · line 1`, status `Error — previous preview retained`. Run never writes the editor, so the draft is unchanged.

### cw_promise_rejection_message_and_line
- Control `Promise.reject(new Error("H")).catch(e => console.log("CAUGHT", e.message))`: patched `then` (242-266) runs the handler,
  no unhandledrejection, `complete` is sent, status `Complete`.
- `Promise.reject(new Error("REJ-31"))` on line 3: subclass constructor records line 3 from the stack (128, 133);
  unhandledrejection (229) calls `fail`, `sourceLine(error)` is also 3. Entry: `REJ-31 · line 3`.
- `run();` on line 1, `async function run(){ await ...; throw new Error("ASYNC-55"); }` with the throw on line 4:
  `origin` stores 4 (114), unhandledrejection falls back to `thrownLines` (229) and the Error stack also gives 4. Entry: `ASYNC-55 · line 4`.
  Holds for `await null`, `await Promise.resolve()` and `await new Promise(r => setTimeout(r, 100))`.
  If `complete` arrives before the rejection event, the error is still processed because `complete` keeps the token (402-403).
- The message is always a string (219), never an empty object.

### cw_output_before_failure_kept
- Entries are only appended (app.tsx:45); Run, Stop and errors never clear them.
- Throw: marker then error entry. Endless loop: guard in the loop body (53, 141) throws at 4.9 s, the marker was posted earlier.
  Timer plus Stop: `stop('Run stopped')` (app.tsx:148, runtime.ts:378-381) appends an info entry. All three markers stay.

### cw_run_starts_fresh_document
- Each Run removes the iframe and creates a new one (387-391) built from `emptyDocument` for .js (321).
  Second run shows only the second paragraph and `typeof window.x` is `undefined`.

### cw_console_levels_in_order
- log, warn, error, info are each posted synchronously (158) and appended in arrival order (398, app.tsx:45).

### cw_html_preview
- The heading is parsed as real HTML (321). The inline handler becomes an `addEventListener` script (334-342) and still works
  after `complete`. The inline script's console marker is posted. The click changes the text.

### cw_interaction_starts_fresh_budget
- After `complete`, `settled` is true. A trusted pointer event resets `started` and `deadline` and sends `interaction` (278-282);
  the parent restarts its 5.1 s watchdog (400). Button 1's one-second timer runs inside the new budget, then `complete` is sent again; no time-limit entry.
- Button 2's self-rescheduling timer: `wrap` -> `check` throws at 4.9 s (230, 141), `fail` posts
  `Execution stopped: five-second time limit` (221), shown as an error entry and the status `Error — previous preview retained`. Well inside ten seconds.
  The rethrown duplicate is ignored because the parent cleared its token (403, 395).

## Supporting checks
- Server listens on 0.0.0.0 (server.js:142), so the runner frame on the other loopback hostname (388-391) loads.
- The server CSP header (server.js:16) allows inline scripts and frames from localhost and 127.0.0.1, so it does not block the nonce scripts written into the runner.

## Not verified
- No live browser run. Chromium event ordering (settle timer vs unhandledrejection task) was reasoned, not measured; both orders give the same visible result.
- Editor typing behaviour (auto-indent, bracket handling) while entering these fixtures was out of scope.
