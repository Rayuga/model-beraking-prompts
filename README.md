# WebDev task workspace

Start with [local QC](qc/README.md), then [authoring context](NEW_TASK_AUTHORING_CONTEXT.md) and [workflow](TASK_AUTHORING_WORKFLOW.md). The [review policy](qc/REVIEW_POLICY.md) records lessons from repeated portal failures.

For another device or a new task agent, read the [complete task-authoring handoff](NEW_DEVICE_TASK_HANDOFF_2026-09-30.md). It includes setup, model roles, difficulty targets, template boundaries, golden verification, independent QC, current blockers and a ready-to-use agent prompt. [Current QC evidence](qc/CURRENT.md) identifies the latest candidate; historical reports do not clear later edits.

- `projects/`: task source and the current `webdev-task-template`. Older tasks are references, not the canonical configuration.
- `harbor-webdev-rubric-qc/` and `WebDev Rubrics QC.xlsx`: review procedure and authoritative check inventory; both are required.
- `qc/runs/`: frozen-candidate manifests, independent reviews, reconciliations and workbooks. A completed report is not a portal acceptance.
- `deliverables/`: candidate ZIPs and unique test evidence. Consult the current task handoff and manifest before choosing a ZIP; older reports are historical.
- `scripts/`: local checks, review orchestration and bounded cleanup.
- `archive/`, `handoffs/` and older root handoffs: retained history. Current task sources and the current review policy take precedence.

The 29 September cleanup removed committed duplicate archive-validation extractions and Python bytecode caches. Original ZIPs, unique run evidence and source/reference projects were retained. Restore paths are listed in [cleanup manifest](qc/cleanup/2026-09-29.json).
