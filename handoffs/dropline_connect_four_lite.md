# DropLine Connect Four Lite Handoff

Updated: 2026-09-01

## Objective

Deliver `dropline_connect_four_lite` as a compact full-stack Classic & Board
Games task. BazaarBridge is a structural reference only. Do not edit or package
the BazaarBridge folder as part of this task.

The task must produce useful RL signal: the reference solution should score at
least 0.95, no-op should score at most 0.05, known-wrong solutions should score
at most 0.20, and repeat scoring must be stable. Passing render alone must not
earn meaningful reward.

## Authoritative local guidance

- `TASK_AUTHORING_CONTEXT.md`
- `Deliverables Tracker_- WebDev_.xlsx`
- `RL_Task_QC_Scorecard (2).xlsx`
- `upload-checks-README.md.docx`

Files in `old-qc-and-formats/` are historical references, not the current
acceptance standard.

## Task location and naming

- Working task: `projects/dropline-connect-four-lite/`
- Package: `codearena/dropline_connect_four_lite`
- Delivery wrapper ZIP folder: `dropline_connect_four_lite/`
- Category: `Software`
- Subcategory: `Classic & Board Games`
- Tracker assignment: Tic-tac-toe / Connect-4

The local project directory retains its historical hyphenated name. New package
and delivery names use lowercase snake_case.

## Product contract

DropLine is a two-person Connect Four game played in one browser. It has two
seeded accounts, both using password `password123`:

- `avery@dropline.test` - Avery Morgan
- `jordan@dropline.test` - Jordan Lee

Before sign-in, board and account state must be hidden. Successful sign-in
issues an unpredictable bearer token, stores the active token in SQLite, and
shows the signed-in name and email. Sign out invalidates that token.

Each account owns an independent current board and independent Red wins, Yellow
wins, and Draws totals. Accepted moves and New game are saved server-side before
success is shown. Reload and later sign-in restore the exact board, turn or
result, winning cells, and totals.

Gameplay is conventional 7-by-6 Connect Four:

- Red starts and accepted moves alternate colors.
- Pieces fall to the lowest empty cell.
- A full-column attempt changes no state and reports `Column N is full`.
- Horizontal, vertical, and both diagonal wins work for both colors.
- A win marks exactly four winning cells, increments the matching total once,
  and locks the terminal board.
- A full board without a win shows `Draw`, increments Draws once, and locks.
- New game clears round state, starts Red, and preserves match totals.

## Runtime contract

- Frontend: vanilla HTML, CSS, and JavaScript.
- Backend: Node.js with Express.
- Storage: SQLite through `better-sqlite3`.
- App root: `/app`.
- Entrypoint: `node /app/server.js`.
- Browser entry: `/app/public/index.html`.
- Database: `/app/dropline.db`.
- Port: `3000`.
- Runtime network: no external assets or APIs.
- Installed dependencies: Express 5.1.0 and better-sqlite3 12.4.1.

The product contract is split across five files under
`environment/instructions/`: overview, authentication, gameplay, persistence,
and interface. The seed-only workbook is
`environment/assets/artifacts/dropline_seed.xlsx`; its two tabs are Accounts
and Initial Game State. `instruction.md` remains short and refers to the mounted
paths `/instructions` and `/assets/artifacts/dropline_seed.xlsx`.

## Reference solution

The golden solution is under `solution/app/`:

- `server.js` creates users, sessions, and game state in SQLite and validates
  moves in server-side transactions.
- `package.json` documents pinned runtime dependencies.
- `public/index.html` contains the vanilla UI, authentication client, board,
  scores, keyboard interactions, responsive styling, and accessibility names.
- `solution/solve.sh` installs these files into `/app` and removes stale DB
  files before an Oracle run.

## Verification structure

The task uses Codex with `openai/gpt-5.6-luna`, temperature 0, and five judge
directories. There are 15 total criteria:

- Render, 2: authenticated render and core game render.
- Constraints, 2: account isolation and server-backed same-origin persistence.
- Functional, 6: gravity/full column; horizontal/vertical wins; both diagonal
  wins; Yellow win/terminal lock; exact draw/terminal lock; New game/reload.
- Polish, 3: accessible cell names; keyboard play; mobile layout and feedback.
- Aesthetic, 2: visual craft and coherent production readiness.

Render and Constraints each have dimension weight 0.25 so cheap gates account
for about 5.9 percent of total dimension weight. Functional has weight 4,
Polish 2, and Aesthetic 2. Every dimension has a liveness/authentication gate,
treats submitted content as untrusted, and rejects required external traffic.

`coverage.json` maps 11 stated requirements to all 15 criterion IDs and the
launch preflight. Exact sequences and expected cells are in the judge criteria;
the judges should evaluate outcomes without requiring one DOM shape or endpoint
name.

The persistence constraint also captures a successful bearer-authenticated
state request, signs out, replays the request with the old token, and requires a
non-2xx rejection before signing in again. This is the server-side positive and
negative control for token invalidation.

## Harness behavior

`tests/test.sh`:

1. Writes zero reward before doing work.
2. Requires `/app/server.js` and `/app/public/index.html`.
3. Rejects symlinks in `/app`.
4. Copies the submission to `/tmp/dropline-submission`.
5. Deletes copied SQLite artifacts and runs the app as UID/GID 65534.
6. Waits for a successful same-origin health response.
7. Runs RewardKit with a timeout and preserves zero reward on launch/judge
   failure.

The verifier image pins Codex, Playwright MCP, RewardKit, Express,
better-sqlite3, Python packages, and the Chromium installation.

## QC order

Do not spend model tokens before these stages are clean:

1. Parse every TOML and JSON file.
2. Validate workbook tab names and mounted paths.
3. Validate every coverage criterion exists and every judge criterion is mapped.
4. Check Docker and shell syntax, package paths, metadata, network declarations,
   pinned dependencies, reward-on-failure, and verifier isolation.
5. Run the golden server and deterministic API/browser smoke tests.
6. Perform the first task QC and retain its report outside the upload folder.
7. Run the upload-rule checks.
8. Build the task ZIP and inspect its central directory.
9. Run Oracle once. Require at least 0.95 before model runs.
10. Run gpt-5.4-mini, Haiku, and Sonnet 4.5 once each, then review failures.

The scorecard hard gates are C1 correct rollout passes, C2 wrong rollout fails,
C3 reward ordering is not inverted, and E1 repeated rescoring is identical.

Reusable local smoke scripts are kept outside the task package at
`.tools/dropline_api_smoke.js` and `.tools/dropline_browser_smoke.js`.

## Harbor command templates

Set the key interactively. Never save it in this repository:

```powershell
$env:OPENROUTER_API_KEY = Read-Host "Enter OpenRouter API key"
```

Oracle:

```powershell
harbor run `
  -p ".\projects\dropline-connect-four-lite" `
  -a oracle `
  --env docker `
  --ve "OPENROUTER_API_KEY=$env:OPENROUTER_API_KEY" `
  --jobs-dir ".\projects\dropline-connect-four-lite-jobs" `
  --job-name "dropline_connect_four_lite_oracle_01" `
  -n 1 `
  --yes
```

Model run:

```powershell
harbor run `
  -p ".\projects\dropline-connect-four-lite" `
  -a openhands `
  -m openrouter/openai/gpt-5.4-mini `
  --env docker `
  --ak reasoning_effort=high `
  --ak version=0.62.0 `
  --ae "OPENROUTER_API_KEY=$env:OPENROUTER_API_KEY" `
  --ve "OPENROUTER_API_KEY=$env:OPENROUTER_API_KEY" `
  --jobs-dir ".\projects\dropline-connect-four-lite-jobs" `
  --job-name "dropline_connect_four_lite_gpt_5_4_mini_high_01" `
  -n 1 `
  --yes
```

## Packaging and deliverables

The upload ZIP must expand to exactly one wrapper folder named
`dropline_connect_four_lite`, with task files directly inside that wrapper.
Exclude handoffs, reports, jobs, generated databases, local logs, secrets,
Codex configuration, and caches.

Retain separately:

1. Task ZIP.
2. Oracle run ZIP.
3. gpt-5.4-mini model run ZIP.
4. Haiku model run ZIP.
5. Sonnet 4.5 model run ZIP.
6. Evaluation report.
7. Boardloom-style case study.

## Current status

Version 4 task text, split instruction files, seed workbook, full-stack golden solution, five judge files,
runner, verifier image, and coverage map have been rewritten. Static validation,
golden smoke testing, first QC, upload checks, ZIP creation, Oracle, and model
runs must be recorded after the rewrite before the task is marked ready.
