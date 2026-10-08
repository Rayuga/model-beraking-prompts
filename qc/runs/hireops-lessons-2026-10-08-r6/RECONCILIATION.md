# HireOps, Colderwater-lessons round 6 reconciliation

**BLOCKED, and preflight false.** All 54 reports are valid, on input `de71097d…`.

| Result | Rows |
|---|---|
| Fail | 26, 28, 31, 32, 33, 37, 42 |
| Note | 30, 40, 50 |
| Not exercised | 11 |
| Pass | all other quality rows |

- **Deterministic review:** 44 Pass and 4 N/A (legacy layout), with one risk: the scored-budget headroom is unmeasured.
- **Preflight:** false only on `judge header:functional`. This is the lead-instructed individual mode.
- **Proxy errors:** rows 6, 36, 39, 49 and 53 were relaunched in fresh contexts. Row 40's report was complete before its connection dropped, so it stands.

## Fixed in the next candidate

**Row 26:** the all-jobs Activity view is now graded alongside the one-job filter.

**Row 31:** every write kind is now covered by every read-only role.
- The Observer, candidate and anonymous replays now include re-ordering and reopening.
- The other job's manager (Bill) now tries a move, a re-order, a rejection, a reopening and a note. The server must refuse each one.

**Row 28:** a refusal leg for Ingrid or Bill exists only when Rafael's same-kind control succeeded in that session. This is the same rule `hro_readonly_roles` already used.

**Row 30 (accepted hardening):** two positive controls are now explicit steps.
- The candidate-privacy check first reads a suffixed note and rejection reason back as Rafael.
- The manager-roles check names Rafael's moves, re-orders and reopenings as the controls for Ingrid's refusals.

**Row 32:** `hro_pol_earlier_place` now works for apps that load earlier messages when the reader reaches the top. The reference message is read a few pixels below the top, and the load is triggered by the app's control or by scrolling the last pixels.

**Row 33:** where Mei Lin stands in for a candidate who cannot send, the Bars of `hro_unread_seen`, `hro_long_thread` and `hro_pol_live_thread` now read that candidate's name as Mei's.

**Row 37:** under the shared Product Designer fallback, the judge first moves earlier sessions' suffixed cards out of Interview and Offer, never seeded cards, so the job's places stay usable across sessions.

## Open: structural (row 42), needs the owner's decision

Each functional criterion is now one binary bundle that carries the sum of its legs' weights. A minor failed leg therefore zeroes the whole bundle. Example: app X has one free-place glitch and loses 5.5 points; app Y has a missing core stale-move check and loses only 4. So X can score below Y even though Y lacks a core rule. Rows 40 and 42 in round 5 raised the same concern.

The usual fix is per-leg criteria, and individual mode makes that hard:
- each criterion gets its own judge session;
- `test.sh` caps the whole scored suite at 11100 s;
- with 15 bundles at 600 s, the suite already fills 10800 s of that cap.

Splitting the bundles further would need shorter sessions or a larger budget. This is not fixed here. The owner has been asked to choose an approach.

## Evidence after the changes

- **Golden:** installed with `solve.sh` and run as uid 65534 with a real restart, it passes all 26 driver groups.
- **Static checks:** the grader-term and criterion-id checks pass, and the 10-gram overlap scan finds nothing. The largest functional criterion is 2.9 KB.
- **Package:** `deliverables/hireops-recruiting-operations/2026-10-08-individual-mode-r6fixes/` (sha256 `c217d423…`, 35 files).
- **Not measured:** none of this is a judge, Oracle or model measurement.
