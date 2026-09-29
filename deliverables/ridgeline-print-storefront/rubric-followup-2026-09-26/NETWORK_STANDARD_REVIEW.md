# Public browser assets: correction to the previous reviews

The current staged profile permits app fonts, browser scripts and CDN assets from other origins. Both preserved candidates contain a conflicting app-wide restriction: Ridgeline `f8a9b605…` and Colderwater `76ab7fb1…`. This is a real authoring defect. Repeating a restriction in public notes and criteria does not establish an authorized exception to the profile.

## Authority and scope

- `harbor-webdev-rubric-qc/SKILL.md`, Delivery profile: network is public in both phases; “CDN or off-origin browser assets” are correct.
- `projects/webdev-task-template/environment/instructions/integration.md:12`: the app may load external fonts, scripts or CDN assets; it cannot depend on an external backend or data service.
- `projects/webdev-task-template/tests/gates/constraints/judge.toml:25`: external assets must not fail the gate.
- `harbor-webdev-rubric-qc/references/quality-checks.md:125`, `:147` and `:163`: same-origin gates are defects, server-backed is not the same as same-origin, and a CDN request is not a mock/floor witness.
- `harbor-webdev-rubric-qc/references/deterministic-checks.md:24–27`: no offline constraint needs to be stated; external assets are NOTE-only under this public network profile.
- `TASK_AUTHORING_WORKFLOW.md:68`: do not introduce blanket offline or same-origin conditions.

The user asked to follow the new template and standards. Older Patchpad delivery wording concerned that older task; it does not authorize reinstating its offline browser-asset rule in every new task. No current user exception requiring offline browser assets for these two tasks was identified. Our previous reasoning accepted our own public wording as if it established such an exception; that was circular.

The local Node/Express/SQLite backend, supplied runtime and durable data requirements remain valid. CDN permission does not permit substituting an external database or hosted application backend. Nor does it require the golden to use a CDN: its existing local assets remain valid.

## Exact preserved defects

Ridgeline's `environment/instructions/integration.md:11` bans external requests when opening the finished shop. Its `tests/gates/constraints/judge.toml:25` makes a required CDN script or remote font/image fail an all-pass prerequisite. A otherwise working server-backed shop using permitted assets could therefore receive reward zero. The “do not demand identical URL origins” qualification did not undo the actual remote-asset ban.

Colderwater's `tests/scored/functional/judge.toml:31` requires the editor and examples to use local resources without external fonts or scripts. Its brief, integration/policy/security notes, metadata and app context also describe blanket offline operation. That is the same policy error even though its direct score effect is confined to F01 rather than a zeroing gate.

Line quotations, source hashes and exact prior archive hashes are preserved in [network_standard_evidence.json](network_standard_evidence.json), so this finding is not dependent on subsequently edited working files.

## Colderwater's separate snippet boundary

Authored snippets are untrusted product input. The public security note explicitly requires those snippets to be unable to request external resources or services. `cw_preview_network_requests_blocked` tests that boundary through a controlled fetch and image load after an unprotected positive control. This is a requested sandbox behavior, comparable to keeping snippets out of parent storage; it is not a prohibition on the host app's CDN usage.

The minimal correction therefore permits external browser assets for the app and removes F01's app-network ban while preserving the authored-snippet restriction and its existing 0.5-weight criterion unchanged. No networking APIs, source inspection, new routes or additional mechanisms should be added to that snippet criterion as part of this fix.

## Review correction

The prior reports' app-network PASS rationale is superseded. Their source, browser and archive evidence remains a record of what was actually checked; those checks did not prove compliance with this standard. The new final review must explicitly reconcile the standard, public notes, criteria, prompts and app context, and demonstrate the local guard fails the preserved bad wording before accepting its corrected result. No official platform or paid model result is implied.
