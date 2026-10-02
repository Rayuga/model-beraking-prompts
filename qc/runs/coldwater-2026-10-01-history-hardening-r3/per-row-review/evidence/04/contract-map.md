# Row 04: public ask against graded demands

Frozen input: `80865100dd4b973cb1cfb54e92a812e3f989440975a22dd2519f5f5d5256e841`.
The workbook's `Quality Checks` row 5 (quality check 4) and `Internal Quality Checks` row 5 define this review. The frozen skill's `references/quality-checks.md` section 4 calls for a runtime-fact list and a criterion-to-public-ask comparison. The attached `criterion-inventory.txt` was parsed from all five frozen `judge.toml` files: 2 gates, 82 Functional, 6 Polish, and 6 Visual criteria. It is an inspection aid, not a configured judge result.

| Verifier assumption | Public source | Frozen verifier source |
| --- | --- | --- |
| Deliver `/app`, ordinary files, bounded symlinks | `instruction.md:9`; `environment/instructions/integration.md:5,15` | `tests/test.sh:70-83,97-111` |
| Start `node /app/server.js`, independent of working directory | `environment/instructions/integration.md:5,7` | `tests/test.sh:97-111,160-167` |
| Bind `0.0.0.0:3000`, serve `/`, answer `GET /api/health` | `environment/instructions/integration.md:5` | `tests/test.sh:48,104-111,136` and all five browser prompts' localhost URL |
| `PATH`, `NODE_PATH`, writable `HOME`, `PORT=3000`, `DB_PATH` | `environment/instructions/integration.md:7` | `tests/test.sh:104-110,160-167` |
| Default `/app/app.db`, honor `DB_PATH`, survive browser and process restart | `environment/instructions/integration.md:7-9`; `environment/instructions/behaviour.md:40` | `tests/test.sh:97-102`; Functional S21/S22/S37/S38 |
| Seed `/assets/seed_data.json`; initially empty saved library | `instruction.md:5`; `environment/instructions/integration.md:11`; `environment/instructions/overview.md:3` | `environment/assets/seed_data.json` (`snippets: []`); `tests/app_context.md:8,24` |
| No account or sign-in | `instruction.md:1`; `environment/instructions/overview.md:7`; `environment/instructions/policy.md:3` | `tests/app_context.md:6-8`; gate prompts |
| Fixed clock | Not applicable to this product: no frozen app clock or calendar-dependent figure is set or graded. The five-second relative run budget is stated in `environment/instructions/behaviour.md:9` and `security.md:5`. `tests/test.sh:178` uses `date -u` only in a verifier log line. | No calendar-clock launch variable in `tests/test.sh:104-110,160-167`. |

Graded outcome families and public anchors:

* Render and Constraints gates: real editor/preview/console and successful authored Run are requested by `instruction.md:1,7`, `overview.md:3`, `behaviour.md:5,19`, and `ui.md:3,7`. The shared server library and durable save are requested by `overview.md:7`, `behaviour.md:25,29,40`, and `integration.md:9`. The Constraints probe title is grader-created data, not an imposed product label.
* Functional execution, cancellation, deadlines, last-good snapshots, errors, console, Auto-run, sandbox and snippet network boundary: `behaviour.md:5-21` and `security.md:3-11`. The scenarios accept observed controls and current state. Exact marker strings and line-break fixtures are test inputs for the requested behavior, not added product requirements.
* Functional saved-record identity, exact fields, history, conflict refusal, retry, races, reload and restart: `behaviour.md:23-40` and `integration.md:9`. The prompts explicitly discover actual API routes and fields and accept UI prevention with retained draft where appropriate (`scored/functional/prompt.md:19-25,440-480`).
* Polish and Visual: keyboard, labels, focus, three reachable panes, narrow layout, legibility and a consistent appearance are requested by `instruction.md:7` and `ui.md:3-9`. The judged appearance accepts one scheme, ordinary native controls and different layouts (`scored/polish/prompt.md:24-49`; `scored/visual/prompt.md:13-49`).

Adversarial checks: a working preview with a client-only saved library could pass Render but cannot satisfy the independently cleaned browser context in Constraints. A shared in-memory library could pass that gate but would fail the requested restart durability in S22. A conforming app with different API route names, request fields, control labels or a server-rendered library is expressly allowed by the prompts (`gates/constraints/prompt.md:15-33`; `scored/functional/prompt.md:5-19`; `scored/polish/prompt.md:24-30`). Neither example exposes an unstated graded demand in row 04.

The raw index binds 77 existing artifacts; `artifact-hash-verification.json` records that all 77 current hashes match. `qc/repairs/coldwater-2026-10-01-stricter-r3/full-install-binding.json` records an actual scripted full install started with `node /app/server.js` from `/tmp`, a supplied `DB_PATH`, and health HTTP 200. `local-proof-summary.json` describes scripted product probes. These are not a configured RewardKit judge, Oracle, Luna, visual Likert or portal grade. No private deterministic checker execution is claimed.
