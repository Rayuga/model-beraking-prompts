# Colderwater final golden cross-check

The current golden supports the revised observable requirements. No application defect was found. Six targeted browser groups and five early-restart groups passed locally; all 47 current criteria are mapped to fresh or explicitly reused evidence. This is not a paid Oracle evaluation or a measured platform score.

The final ZIP is `63a05a5e4ebf9501fd520067df33db2510f7198300be566049ee28058a18da64`. Its 23 solution files are byte-identical to the directly tested eight-issue ZIP. Current Functional is `ebdd280b66d66fc87933dc688fa706dbe6793e89d275b1be671ca745af05c97c`.

## Fresh changed branches

| Group | Observation |
| --- | --- |
| Edited example saved copy | Selected `hello.js`, ran it and an authored marker, reselected the original, appended a valid JavaScript comment, and saved `QC Example Saved Copy`. After reload the built-in source remained exact and the distinct saved copy retained its exact filename/source. |
| Positive title trimming | UI create with `  QC Rename Source  ` stored `QC Rename Source`; UI rename with `  QC Rename Source Renamed  ` stored the trimmed title and advanced only that record's revision. Its source/filename and sibling stayed exact. |
| Completed preview Stop | Real click after 6.102 seconds and key/input after another 6.107 seconds worked. Stop displayed cancellation; subsequent available old controls generated no new click/key/input markers. A new Run recovered. |
| Latest successful interaction rollback | `Commit change` established `interaction-committed`; subsequent pending work and a second click at 2.102 seconds timed out at 5.154 seconds. The last committed interaction returned, no late callback appeared, and recovery worked. |
| Static retained-preview alternative | A temporary display overlay showed the committed render while pending and intercepted ordinary second input at 2.103 seconds. No second handler was forced. Timeout at 5.163 seconds restored the committed render, with no late work and successful recovery. |
| Shared original deadline with hidden candidate | A temporary retained-preview overlay hid the pending candidate. The exact four-second callback entered and the overall run stopped at 4.981 seconds; the good render remained and recovery worked. |

The overlays are partial witnesses for permissible display and pending-input policies. They do not modify shipped application files or replace its execution runtime. Browser actions used the installed Playwright dependency in the pinned verifier image `sha256:43757904510bf933d70d209e77077ad0173deb345f61a1477eb106f4e2380f6f`, Chromium 152.0.7977.8, with network disabled.

## Early restart and subsequent editing

The reused prior restart witness started from an empty database and contained only two surviving records. That did not observe the current continuing sequence. The fresh proof retains a real clean-context gate record, the now-required saved example copy, and `QC Save Alpha`/`QC Save Beta` before making the restart criterion's own Primary, independently edited Copy, and confirmed Deleted control.

Exactly one actual delivered verifier MCP `restart_app` call relaunched the process. A fresh browser loaded all six surviving identities and exact fields/revisions; the deleted control stayed absent. Primary and Copy both ran, Primary accepted a revision-advancing save, and the other five records stayed exact. A real second dirty editor then retained its source after stale UI Save was refused, deliberately reloaded the latest version, reapplied its edit, and saved successfully without modifying any of the six previous records. The delivered restart-helper template and MCP source match the final ZIP exactly.

## Evidence audit and limits

`GOLDEN_CRITERION_EVIDENCE.json` has all 47 current identity/type/weight/criterion hashes and uses repository-relative evidence paths with SHA-256 values. `golden_evidence_binding.json` binds all 23 solution files, fresh proof artifacts, and source-scoped reuse. The prior actual-MCP security criterion descriptions and supplied network recipe are byte-identical to the final versions; their earlier positive, refusal and alternative controls remain applicable. Existing exact-source error evidence matches the current JS, HTML, timer and Promise fixtures at lines 4, 6, 2 and 2.

Two probe setup corrections are preserved. The first example check used `innerText`, which expands empty CodeMirror display lines, and stopped before Save; joining the rendered `.cm-line` contents fixed source extraction, and only this branch was rerun. The first expanded restart retry encountered the previous local helper's single-use marker; separate log directories fixed the probe setup, followed by one successful restart in a fresh database. Neither correction changed the application.

The complete 47-criterion judge was not run end to end, and visual judgments remain provider-unmeasured. The user's preview remains running on `127.0.0.1:3420` with start time `2026-09-27T11:02:25.269111982Z`; no user database or other container was modified. Disposable golden-test containers were removed.
