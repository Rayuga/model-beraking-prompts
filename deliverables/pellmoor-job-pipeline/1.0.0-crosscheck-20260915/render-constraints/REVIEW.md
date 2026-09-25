# Render and Constraints crosscheck, 15 September 2026

The frozen r8 golden application passed all ten fresh browser/authentication checkpoints through the actual Playwright MCP 0.0.79 runtime. The checks exercised all four Render/Constraints criteria. No task source or frozen package was changed.

The tested package is `1.0.0-r8-reliability-20260914/pellmoor-job-pipeline.zip`, SHA256 `e2cb22b029d958b29bc817003149236a0b0baa51803982fbee1d69ee171c81af`. The source was mounted read-only from that delivery's extracted task. `gate-crosscheck.json` records the exact golden-source and verifier hashes.

| Requirement | Fresh observed result |
| --- | --- |
| Public entry and controls | Local sign-in with usable email, password and button; full reload succeeded. |
| Empty-password interaction | HTTP 401 with a worded error; the sign-in remained usable. |
| Valid authentication | UI login returned HTTP 200 and a genuine server token; Ruth saw four vacancies and a populated selected vacancy. |
| Server-backed protected data | The observed same-origin vacancy read used that issued bearer token and returned the displayed candidate records. |
| Candidate interaction | Pim Okoro opened from the visible board through a successful protected request. |
| Anonymous negative control | The captured protected read returned HTTP 401 before the wrong-password attempt, without vacancy/candidate records. |
| Exact wrong-password attempt | `Wrong-Pellmoor-123` returned HTTP 401, displayed an error and created no authenticated workspace or cookies. |
| Post-attempt negative control | The same fresh anonymous context repeated the protected read and received HTTP 401 without protected records; no credentials were copied or cleared. |
| Valid-session positive control | The original Ruth session survived full reload and could reopen the candidate. |
| Browser/runtime integrity | No uncaught page errors; the app stayed on the local entry. |

Read-only database snapshots independently confirmed that roles, candidates, panels, scores, notes, activity and mutation receipts were unchanged by the smoke journey. Both snapshots hash to `1c8615eef3e2ee59305555ff4dd5eba45ca9690073263f298531c8402700ef8b`. Sessions and the login clock are intentionally outside this product-record comparison because genuine sign-in creates a session.

## Verifier scope review

Render has two small binary checks: the public page loads/reloads, and a public sign-in control responds. Constraints has two: the local application entry stays same-origin, and it remains usable across interaction/reload. The explicit shared authentication prerequisite is appropriate to this bearer-authenticated product and is required by the workspace task standard.

The frozen prompts accept alternative routes and response shapes, allow public assets, use current persisted state, tell the judge to use a fresh context when inspecting sign-in after authentication, and explicitly exclude completing a batch from these dimensions. No additional restriction or unwarranted assumption requiring removal was found.

The latest uploaded Oracle remains `pellmoor-job-pipeline__sfvtUWB` on task checksum `23c88a5ab83d1877cad1fd16d23bc9f0d7c5773fc801e16663a599eaa3fe21b2`. It reported Render 1.0 and Constraints 1.0, with all four criteria passing. Its Visual 0.9583 and Functional 0.7449 deductions were separate. That platform run used the earlier r4 Render/Constraints prompts within the r7 task revision.

Frozen r8 retains those four criterion descriptions, IDs and weights; it normalizes independent-evidence wording and aligns their aggregation from `all_pass` to the canonical `weighted_mean`. The latter changes mixed pass/fail aggregation, but not these uploaded all-pass outcomes. The shared zero-on-failure gate remains intact.

## Evidence and limits

- `gate-crosscheck.json`: ten checkpoint results, network status/details, exact source hashes and unchanged-product proof.
- `mcp-gate-raw.json`: actual MCP tool result.
- `signin-initial.png`, `signin-empty-password.png`, `signin-wrong-password.png`: public controls and both negative login cases.
- `authenticated-candidate.png`, `authenticated-reload.png`: protected workspace and reload positive controls.
- `product-before.json`, `product-after.json`: read-only golden diagnostic snapshots.
- `setup.sh`, `mcp-gate-check.cjs`, `gate-workflow.js`: reproducible external validation scripts.

This used the cached `pellmoor-tests:2.0.3` image with the frozen r8 solution. It is fresh actual-browser validation, not a hosted LLM rescore, proof of the exact final Docker build, or a guarantee that a future judge will collect every required observation.
