# Pellmoor GPT rerun diagnosis ? 14 September 2026

GPT-5.4-mini scored 0 again because its second submission serves HTML in place of its JavaScript and CSS. This is a different application defect from the earlier timestamp crash.

## Evidence

- Run: `run-96a96c7e-678f-45a1-9b05-bd3bccadc01f`; trial: `pellmoor-job-pipeline__iERE3xD`.
- Same platform task checksum as the previous Oracle and GPT runs. All 12 recorded prompt/judge/runner/reward hashes match the frozen batch-offer package.
- Node starts successfully. No trial exception or timeout is recorded. The solver ran for approximately 14 minutes; evaluation took approximately 3 minutes.
- Built assets exist: `public/app.js` (210,927 bytes), `public/app.css` (10,321 bytes), and `public/index.html` (389 bytes). This is not a missing build artifact diagnosis.
- `public/index.html:8` requests `/app.css`, and line 12 requests `/app.js`.
- `backend/server.js` registers no `express.static(PUBLIC_DIR)` or equivalent asset routes. The fallback at lines 1788?1793 sends `index.html` for every non-API request, including the script and stylesheet URLs.
- All five judges describe an empty interface, HTML returned for `/app.js`, and fatal JavaScript parsing error `Unexpected token '<'`. Reload and a fresh browser context do not resolve it.
- The global browser prerequisite fails, so all 60 criterion scores become zero. This does not mean 60 business requirements were independently exercised and failed.

## Why GPT did not catch it

The solver trajectory records 59 terminal calls, 22 file-editor calls, three task-tracker calls and one think call. It builds the frontend and exercises login, protected reads, stage changes, scoring and batch APIs with curl. No actual browser verification or HTTP check of the built asset URLs is recorded. A successful build and working API therefore gave it incomplete evidence of completion.

The solver's final claim that it verified key flows describes API checks; it does not establish a rendered, interactive workspace. The server needs static-file handling before its HTML fallback. That repair belongs to the solver submission; this audit has not applied it or altered the evaluation.

## Comparison and interpretation

| Attempt | Observed blocker | Result |
|---|---|---:|
| Previous GPT | `created_at` backend field read as `createdAt`; date formatting crashes after login | 0 |
| New GPT | Missing static-file route; script URL returns HTML; blank page before login | 0 |
| Oracle on this package | All 60 criteria passed, including the complete browser journey and Visual | 1 |

Two independent frontend integration mistakes caused two gate zeros. The evidence supports both zeros; it does not demonstrate that the new batch rules themselves defeated GPT. The inference that the task's complexity is diverting effort from browser validation is plausible, but these two runs do not prove a causal relationship or stable model performance.

The task still has not demonstrated the intended 0.1?0.7 GPT band. Another identical rerun may produce a working app, but repeating unchanged runs is not a reliable remedy for the observed missing end-to-end verification.

## Recommended next step

Retain both original results. Add a short, general, agent-visible completion check to the task in a separately versioned revision: start the shipped server, open the root in a real browser, confirm referenced scripts/styles return executable JavaScript/CSS with suitable content types, sign in, open a vacancy and candidate, reload, and check for fatal errors. Apply the same guidance to every solver. Preserve all domain rules, scoring weights and the substantive browser gate.

This would reduce incidental delivery failures without removing the difficult batch/concurrency/receipt requirements. It cannot guarantee a score in range. After such a task change, freeze a new ZIP and rerun Oracle and GPT; the current Oracle result does not validate a changed artifact automatically. Do not repair GPT's exported app and present that repaired result as a fresh model score, or weaken the zero gate to force an in-band result.

Task source, original ZIP and uploaded runs were not changed. `audit.json` records the metadata, source locations, judge evidence and hashes of every file in this new run. No new browser run or score was generated during this review.
