# PatchPad 2.0.9 — latest Oracle and Haiku review

Oracle run-f7de94c0 used 2.0.8 and scored 0.8265: Functional 0.7108,
Render/Constraints/Polish 1.0, 20/27 Functional passes. Its exported golden
artifact matches the 2.0.8 ZIP. The full judge action trace was not exported.
Haiku run-48c545c9 also used 2.0.8 and returned zero with graded=0/no_op=1:
its manifest again omitted the documented SQLite path: declaration. It never
reached browser grading. Neither is a score for this new release.

## Seven Oracle failures

- Word navigation: the sample was inserted at line 1202, not the final line.
  A local real-keyboard test confirmed Ctrl+End moved only to the current line
  end. Added conventional Ctrl/Cmd+Home/End, including Shift selection. This
  repairs a real golden navigation defect but does not prove which shortcut
  the historical judge used. Verifiers still do not mandate this shortcut.
- Unicode deletion: no qualifying selection/mutation was observed. Existing
  exact browser regressions pass. Custom editor selection is not necessarily
  window.getSelection(); require real focused-editor Copy and fresh clipboard.
- Unicode navigation: omitted before the final API criterion. Prompt now
  explicitly says to finish it in order; it still receives no credit if skipped.
- Mouse range: whole line was selected instead of two words. Exact separate
  mouse gesture regression passes; prior single-mousedown guidance is retained.
  Without the full action trace, no new golden mouse defect is established.
- Paste/cut: observation did not establish an empty middle line. Real cut
  reproduction preserves exactly [PASTE-A, empty string, PASTE-C]. Prompt
  explicitly forbids dropping empty logical lines from the comparison.
- Find/Replace: copied stale PASTE-B and replaced line 19 instead of line 18.
  Fresh Find/Copy regression passes. Prompt requires fresh query/selection
  checkpoints before replacement; unestablished checkpoints still fail.
- Revision preview: restore/Undo worked, but the judge checked body text rather
  than the preview. Current draft markers legitimately remain elsewhere in the
  page. Scoped exact preview/restore/Undo reproduction passes. Preview containers
  now have accessible region labels; the prompt specifies scoped observation.

No criterion, id, assertion, weight, scoring formula, seed, timeout, restart
helper or readiness/manifest parser was weakened or removed. All 35 criteria
remain. Only the golden navigation fix, preview accessibility labels, clearer
Functional observation guidance and release markers changed. The already
required manifest line is repeated prominently in instruction.md with an
example; that is not a new requirement. Haiku artifacts were NOT repaired.

## Validation and limits

Both final Docker images built with cached dependencies. Fresh local validation
covers syntax, criterion discovery, five valid/six invalid manifest cases,
empty-submission zero, 22 baseline/QC/restart/earlier-failure browser groups,
14 additional groups, six Unicode/clipboard variants, and three new targeted
checks. The document-edge check failed before repair and passed afterward.
The runner's trusted local stub and two negative controls also passed.
These are overlapping regression groups, not a 35/35 paid Oracle grade.

Both networks remain public; Codex/openai/gpt-5.6-luna/high remains the judge.
No paid run or actual platform static/rubric checker was invoked. The local
evidence cannot guarantee Oracle 1.0, and some historical failures remain
unexplained execution/observation gaps rather than proven golden bugs.

Upload the single task ZIP in this folder for fresh QC and Oracle. Haiku needs
a new valid submission if completed browser grading is required; simply
regrading its unchanged malformed manifest would fail again. Historical model
scores do not establish a score for this revised verifier prompt. Reports and
all evidence remain outside the 30-file task ZIP; old ZIPs/runs are preserved.
