# Final-delivery manual QC review

Audited the nested `common-ground-ballot.zip` read directly from
`common-ground-ballot-final-deliverables.zip`, not just the working directory.
Reference: `projects/bazaarbridge-marketplace-commerce/task.toml`.
The delivered task SHA256 remains
`76b8cceb5eb22b2a48df6d53d58f647814516722b4beed6e8f7d7fef625cc578`.

**Configuration matches the reference. The literal reward-code requirement and
the request for no unnecessary commentary need qualification.** No deliverable
was modified in this audit.

| User's check | Result |
| --- | --- |
| Same task.toml keys as reference | Pass: identical nested table/key structure. |
| Consistent timeouts | Pass: agent 7200 s, build 600 s, verifier 13200 s, all matching reference. |
| Version v1.0.0 | Reference and delivered literal are `version = "1.0.0"`; neither uses the `v` prefix. This is the established v1.0.0 release format. |
| Identical verifier.env | Pass: same four keys and values, including the API-key environment placeholder; no actual key is supplied. |
| No provider API-key mentions in verifier Dockerfile, test.sh or environment Dockerfile | Pass across all three files, including their comments. |
| Verifier reasoning effort max | Pass in tests/Dockerfile and verifier.env. |
| Required reward formula | Runtime equivalent at four-decimal output precision; requested literal block is absent. See below. |
| Five verifier folders | Pass: constraints, functional, polish, render, visual. Reference spelling is `tests/`, not `test/`. |
| judge.toml in every verifier | Pass; each also contains its adjacent prompt.md. |
| No judge/model override keys | Pass in all five judge.toml files. The required `[judge]` table remains; it is not a `judge = ...` override. |
| No unwanted code comments or debug residue | Code comments explain runtime behavior or the supplied starter; no TODO/FIXME/HACK/debugger markers found. README retains nonessential release history and historical scores. |
| No extra files in task ZIP | Pass: 29 files in the established closed layout; reports, evidence ZIPs, caches and delivery helpers are not inside the task ZIP. |

## Reward implementation

`tests/test.sh` writes and invokes a private Python scorer. That scorer reads
the Functional/Polish/Visual weights from their authoritative judge.toml files
(0.6/0.2/0.2), gates on Render/Constraints, and calculates the normalized weighted
mean. These weights sum to one. The same delivered scorer matched the user's
formula in 1,109 direct checks, including zero gates, endpoint combinations,
random valid scores and the recorded GPT result of 0.5788.

However, the exact `if data["render"] <= 0.0 ... reward = 0.6 * ...` source block
is not present. Thus a checklist requiring that literal code cannot be marked
fully passed. Earlier Common Ground platform feedback required a single source
for dimension weights; the current implementation reflects that correction.
The latest user checklist takes precedence if it requires the literal source
form. Any repair should keep the authoritative weights consistent and rerun the
scoring regression checks, rather than silently duplicating conflicting values.

## Nonessential commentary

The package README includes release sections for r25/r26/r27, historical counts
(57 Functional / 77 total), and prior r24 Oracle/GPT scores (0.9521 / 0.7885).
They are explicitly historical, but unnecessary in a final task handoff. A clean
README would retain only the current product/runtime/scoring contract and move
release history to the external preparation report. Existing operational code
comments do not need blanket removal.

The original scored ZIP remains unchanged so its Oracle/model provenance is not
misrepresented. A cleaned package should be a separately identified revision;
the existing scores belong to r27 and must not be silently relabeled.

Evidence: [machine-readable checks and comment inventory](manual-qc-audit.json)
and [reproducible audit](manual_qc_audit.py). There are 36 passed checks and two
flagged cleanup/compliance points. This is a local review, not a platform QC run.
