# PatchPad: consistent working-content gate

Upload `patchpad-editor-v2.zip` from this folder. Task version remains 1.0.0.
This release follows the platform v113 result: 45/45 static checks passed,
52/53 rubric-source checks passed; the remaining finding was inconsistent
non-functional-shell rejection across dimensions. That result belongs to the
previous package, not this new ZIP.

## Source changes

Only the five dimension prompts changed relative to the server-response-fairness
release. They now share an identical working-content prerequisite: reject blank,
loading, error and static non-functional shells; observe one real non-mutating
interaction with the loaded report. Caret/selection movement, Find navigation or
a real revision preview are acceptable alternatives, not cumulative requirements.
A single broken control does not prove a static shell if another interaction works.
Clean up search/preview UI before continuing. Do not edit, save or restore content
for this check, and do not turn it into a full Functional audit.

Visual's no-typing instruction now explicitly means document text, allowing a
Find query for the shared prerequisite. Presentation scoring remains unchanged.
All five prompt revision markers advance: Polish r4, the other dimensions r3.

The previous fairness fixes remain: initial HTML and embedded server-delivered
data are valid; separate read APIs are not required. Exact persistence checks,
save-rejection probes and the feedback-scope correction are unchanged.
All 39 criteria, their descriptions/types/weights, reward calculation, golden
source, task.toml, Dockerfiles and lifecycle helper are byte-for-byte unchanged
from the previous package. Both network settings remain public.

## Local evidence and limits

See standard-checks.json for 118 local standard checks and package-audit.json
for source/archive preservation assertions, per-file hashes and the ZIP SHA-256.
The two diagnostic runs use the current task source in disposable containers
with the cached patchpad-preflight-tests:2.0.9 image. One runs the unchanged
golden app; the other delivers report/history reads only through HTML responses.
GET read-API routes are disabled in that temporary variant, not in task source.

Each server-reads.json lists the ten completed browser/comparison groups:
exact seed/metadata/history, the shared non-mutating gate exercised five times,
a static cloned-report negative control, unsaved discard, no-op saves,
revision preview/restore/Undo, stale-save rejection, seven malformed-write
nonmutation probes, two real process restarts and comparison negative controls.
The gate tests verify the saved content/revision/history are unchanged after
each interaction. The dead-shell control tests the local interaction probe;
it is not a claim that a paid judge actually scored an adversarial submission.

runtime-check.json records Bash/Node syntax, no-op zero handling, current prompt
provenance hashes, five-dimension CTRF generation and injected-stub reward
arithmetic. A stub is used instead of a paid judge; its reward is not an Oracle
score. Diagnostic containers have networking disabled to prevent paid calls;
the task's packaged agent and verifier networking remains public.

No paid Oracle/model run or full platform rubric run was launched. These focused
regressions are not all 39 criteria executed by the platform judge. The full
conditional forged-request matrix and a text-only server-rendered implementation
were not rerun. Exact current Docker images were not rebuilt; Dockerfiles are
unchanged. Judge interpretation can still differ on the platform, so Oracle 1.0
and a clean QC result are not guaranteed. Historical evidence/ZIPs are untouched.
