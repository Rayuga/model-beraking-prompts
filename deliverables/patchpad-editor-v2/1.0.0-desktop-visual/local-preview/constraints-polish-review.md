# Constraints and Polish review

Tested the running golden app on 2026-09-11, at 1280x800, through a fresh real
Chromium context. No document edits/saves/restores or task changes were made.
The server document and revision were identical before and after the checks.
This is local browser evidence, not a configured LLM oracle score.

Passed: the shared live-data/custom-surface prerequisites; both Constraints
criteria; labelled primary controls; and keyboard focus/editor entry.
Real Tab/Shift+Tab reached the search fields, representative toolbar controls,
editor and history controls. Escape returned from editor to Find, and all
observed keyboard focus indicators had a visible 3px solid outline.
Disabled Save/Undo/Redo on an unchanged document are expected, not absent UI.

`history_and_feedback_readability` is only partially verified. Revision and
timestamp text and normal Saved status are visible. The error container has
role=alert but no text and zero height while no error exists. The current
Polish prompt forbids edits/saves/restores, so its judge cannot normally
produce the save-error state required to examine visible failure feedback.
An empty alert element alone is not proof of rendered error readability.

Recommendation for user review: clarify that this Polish criterion checks
history, current status and any naturally visible feedback, and that an empty
error area in a successful state is valid. Keep actual conflict/error behavior
in the existing Functional checks. Do not require a permanent visible error
on an error-free page. No rubric change has been made in this review.

If this one of three equally weighted Polish criteria is scored no, even
perfect other dimensions yield 0.6 + 0.2*(2/3) + 0.2 = 0.9333, below the
repository's >0.95 oracle target. Resolve this ambiguity before a new oracle.

Evidence: `constraints-polish-results.json`, `constraints-polish-desktop.png`,
`polish-keyboard-focus.png`, and `check-constraints-polish.cjs`.
