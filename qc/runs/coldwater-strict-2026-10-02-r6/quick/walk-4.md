# walk-4: golden vs. six runtime criteria (static trace, r6 frozen task)

Scope: cw_last_good_recovery, cw_time_limit_recovery, cw_stop_cancels_pending_work, cw_newer_run_supersedes, cw_preview_isolation, cw_dynamic_code_refused.
Method: source trace only (runtime.ts, app.tsx run/stop/log/status, runner.html, server.js headers). Nothing was executed in a browser.

## Problems found: 1

### 1. AMBIGUOUS (low) - cw_stop_cancels_pending_work

- Sentence: "If the second marker had already appeared before you pressed Stop, the attempt is void: repeat it once ... the preview must show the control's picture."
- Golden: solution/app/src/runtime.ts:402 (complete promotes candidate to lastGood), :379 and :384 (Stop rolls back to the lastGood captured at Run).
- What the judge observes: on a void attempt the second draft has completed, so its picture (with the second marker) is now the last-good picture. On the repeat, Stop correctly rolls back to that picture, not to the control's. A literal judge then sees the second marker in the preview after Stop and no control picture, and fails a correct app. The console also still holds the void attempt's marker. This only arises on the already accepted slow-Stop path, but the wording makes the repeat unpassable as written.
- Fix: add "before the repeat, run the control draft again and use a fresh second marker".

## Traced and found clean (drafts a judge would plausibly type)

- Control with `setTimeout`, `const iv=setInterval(()=>{clearInterval(iv)...},2000)` and `new Promise(r=>setTimeout(r,2000)).then(...)`: timers set drains (runtime.ts:233, 241), then-callback counter returns to 0 (:262), settle timer sends snapshot + complete (:206-210), parent promotes it (:402). Status "Complete".
- Stop: runtime.ts:378-380 removes the frame (pending timers die), restores lastGood, logs "Run stopped" to the console and status (app.tsx:148-149).
- Time limit: loop guard throws at 4900 ms (:141) -> error event -> console entry "Execution stopped: five-second time limit"; self-rescheduling timer hits the same check in wrap (:230); parent watchdog at 5100 ms covers slow timers (:374). Both restore lastGood (:403, :379).
- Error: :403 restores lastGood; staticDocument (:26-31) re-applies input values and canvas pixels (:14-20) captured at :179-189. The settle timer after the trusted click captures the canvas after the handler has drawn.
- Supersession: a 4000 ms control timer is inside the 4900 ms budget; a newer Run replaces the frame (:387) and its token (:384), so the old write cannot land.
- Isolation: frame is `sandbox="allow-scripts"` on the other loopback host (:387-391), so `parent.document` and `localStorage` throw SecurityError; meta CSP `connect-src 'none'` (:7, :363) makes no-cors fetch reject for both the health address and any https address; console logs still relay after complete.
- Dynamic code: eval / Function throw EvalError under the nonce-only script-src, message normalised at :220; WebAssembly rejection or the `wasm-eval` violation event (:224-227); Worker blocked by `worker-src 'none'` (thrown or via the violation event); `import()` refused at build time (:50-51) with line. The string-and-comment control parses with no ImportExpression and runs.
- Auto-run defaults to off (app.tsx:31), so partially typed drafts do not become last-good.

Not verified here: actual Chromium behaviour for the Worker and WebAssembly CSP paths (reasoned from the code and known Chromium behaviour, not run).
