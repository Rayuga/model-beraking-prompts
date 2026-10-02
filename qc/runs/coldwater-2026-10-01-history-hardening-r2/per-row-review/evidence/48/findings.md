# Row 48 independent source review

Frozen input SHA256: `b10dbfae5ccc478c0bc422ac98a58494148a3c9c1df7b5b226d2b3a9a73f8863` (assignment identity). This is a source-text review, not a live judge or portal run.

The frozen workbook's `Quality Checks!A49:D49` defines row 48 as `dimension_prompts_are_accurate_and_consistent`: every dimension prompt must describe this app, including credentials, screens, entities and deliverable, with no residue from other work, and must report every instance. `Internal Quality Checks!A49:D49` repeats the row and has no further annotation/comment. The frozen skill's `references/quality-checks.md:191-192` directs comparison of every prompt with this app's accounts, screens, entities and deliverable.

The public product is a no-sign-in JavaScript/complete-HTML playground with an editor, preview, console and shared saved-snippet library (`task/instruction.md:1-7`, `task/environment/instructions/overview.md:3-7`, `task/environment/instructions/ui.md:3-9`). Neither the brief nor six public notes specifies file import, file export or upload. The `import` in `task/environment/instructions/security.md:7` is **dynamic module import inside authored code**, which is a distinct security restriction.

Three off-task references remain in dimension prompt prose:

1. `task/tests/scored/functional/prompt.md:7`: “Entered snippet text, saved records and imported/exported user files are product data and may be compared.” Imported/exported user files are not a specified product entity or workflow.
2. `task/tests/scored/functional/prompt.md:102`: “One action is a field edit, activation, upload, navigation, scroll or resize…” No protocol or public requirement uses an upload action.
3. `task/tests/scored/visual/prompt.md:43`: “Do not require a new save, code execution, import or destructive action to earn visual credit.” The import reference belongs to no Colderwater UI flow. Its negative form limits direct scoring impact but remains stale product wording.

The other three dimension prompts (`gates/render`, `gates/constraints`, `scored/polish`), the shared `tests/app_context.md`, and the five dimension criteria sets in `judge.toml` consistently describe the public playground. In particular, their no-sign-in guidance agrees with `task/instruction.md:1` and their editor, preview, console, library and history surfaces agree with `task/environment/instructions/overview.md` and `ui.md`. The frozen generic template prompts contain sign-in, user and tenant examples, but those positive requirements did not survive in the frozen task prompts; Functional explicitly excludes account and tenant probes.

Adversarial pair: a conforming playground can offer only typed `.js`/`.html` source and Save/Load history with no file-transfer control. The three references can steer a judge toward looking for optional import/export/upload surfaces or treating a nonexistent transfer as an action. Conversely, a weak shell with an upload button does not thereby satisfy any requested playground behavior; none of the actual criteria awards it credit. Thus the observed problem is prompt contamination with limited direct score impact, not an established grading failure.

Fix: remove “and imported/exported user files” from Functional line 7, remove “upload” from its action list on line 102, and remove “import” from Visual line 43. Keep dynamic `import()` security probes, which are part of the public contract. Recheck the expanded prompt text after the edit.

SHA256 of inspected frozen files: `task/tests/scored/functional/prompt.md` = `d34d6795d3ff5e6735f13013113bb1238d420f46e4a522809195b6a6efe88ce0`; `task/tests/scored/visual/prompt.md` = `fbe467bd481f8aa37f1204c6642d0b8cbfab9d464b26371964c3bc4c1c5db90f`; `task/instruction.md` = `9e1ed265ff2d2a18829822ac85020cbee3c80146ceac58506f6b5bd5e95ea627`; `rules/WebDev Rubrics QC.xlsx` = `6d44970b2ff67fefad1e2327e743fc226fcd4c50ff55baf899f41069a9b3fd7f`; `rules/harbor-webdev-rubric-qc/SKILL.md` = `8f2b660d1d32df90eb50990f401a0fc23a2ccbbcD49eeb5730bfbb9beF2BEBC3` (hex case immaterial).
