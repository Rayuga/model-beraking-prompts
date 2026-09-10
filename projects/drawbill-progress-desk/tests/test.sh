#!/bin/bash
# DrawBill verifier entrypoint.
#
# Thin by design: it installs and starts whatever the submission declared in
# APP_MANIFEST.md, waits for the app to answer, then hands grading to
# RewardKit. Every reward figure comes from the four judge dimensions in
# render/, constraints/, functional/ and polish/ — none of it is
# computed here. A zero reward is written before anything else runs and is
# guaranteed on every exit path, so a crash produces a reward file rather than
# nothing.
set -euo pipefail
umask 077

# One absolute deadline governs everything below. Every phase (install, build,
# readiness, each judge group, each retry inside a group) is charged against it,
# so no phase can overrun another and the scoring tail is always reached. This
# is the ladder documented in task.toml; keep the two in step.
SCRIPT_START="$(date +%s)"
VERIFIER_TIMEOUT_SEC="${VERIFIER_TIMEOUT_SEC:-12200}"   # [verifier].timeout_sec
TAIL_RESERVE=180            # score merge + trajectory copy after the last group
INSTALL_TIMEOUT=600         # offline npm ci from the baked /opt/npm-offline cache
BUILD_TIMEOUT=240           # optional Vite build
BOOT_TICKS=180              # first readiness poll: 180 x 0.5s = 90s
RESTART_TICKS=90            # per-group restart poll: 90 x 0.5s = 45s

LOG_DIR="${VERIFIER_LOG_DIR:-/logs/verifier}"
APP_SRC="/app"
APP_COPY="/tmp/drawbill-submission"
SEED_SRC="/tests/__assets__/artifacts"
SEED_DST="/assets/artifacts"
APP_PORT="3000"
VENDOR_PORT="${VENDOR_PORT:-3101}"
VENDOR_BASE_URL="${VENDOR_BASE_URL:-http://localhost:3101}"
VENDOR_PID=""
APP_PID=""

mkdir -p "$LOG_DIR"
chmod 700 "$LOG_DIR"
chmod -R go-rwx /tests 2>/dev/null || true

write_zero_reward() {
  printf '0.0\n' > "$LOG_DIR/reward.txt"
  printf '{"reward":0.0,"render":0.0,"constraints":0.0,"functional":0.0,"polish":0.0,"gate_passed":false,"graded":0,"no_op":1}\n' > "$LOG_DIR/reward.json"
}

ensure_reward() {
  test -s "$LOG_DIR/reward.txt" || printf '0.0\n' > "$LOG_DIR/reward.txt"
  test -s "$LOG_DIR/reward.json" \
    || printf '{"reward":0.0,"render":0.0,"constraints":0.0,"functional":0.0,"polish":0.0,"gate_passed":false,"graded":0,"no_op":1}\n' > "$LOG_DIR/reward.json"
}

# Set only after this script's own merge has written the Harbor reward. Until
# then every EXIT path overwrites reward.txt/json to zero, so a submission
# cannot plant 1.0 during install and keep it because the file was non-empty.
REWARD_FINAL=0

cleanup() {
  if [[ -n "$APP_PID" ]]; then
    kill -- -"$APP_PID" 2>/dev/null || true
    wait "$APP_PID" 2>/dev/null || true
  fi
  if [[ -n "$VENDOR_PID" ]]; then
    kill -- -"$VENDOR_PID" 2>/dev/null || true
    kill "$VENDOR_PID" 2>/dev/null || true
    wait "$VENDOR_PID" 2>/dev/null || true
  fi
  if [[ "$REWARD_FINAL" == "1" ]]; then
    ensure_reward
  else
    write_zero_reward
  fi
}

write_zero_reward
trap cleanup EXIT

# Nothing to grade if the submission never produced an app root.
if [[ ! -d "$APP_SRC" ]]; then
  echo "no /app directory in the submission" >&2
  exit 0
fi
# Submissions must not ship symlinks (cued in stack.md / integration.md).
if [[ -n "$(find "$APP_SRC" -type l -print -quit 2>/dev/null)" ]]; then
  echo "refusing to run a submission containing symlinks" >&2
  exit 0
fi

# Build output produced inside the agent's container is untrusted input to
# grading and is never executed as received: the tree is copied as source and
# any dependency or bundle directory is pruned before the install runs.
rm -rf "$APP_COPY"
mkdir -p "$APP_COPY"
cp -a "$APP_SRC/." "$APP_COPY/"
find "$APP_COPY" \( -name node_modules -o -name dist -o -name build -o -name .git \) \
  -type d -prune -exec rm -rf {} + 2>/dev/null || true
find "$APP_COPY" \( -name '*.db' -o -name '*.db-wal' -o -name '*.db-shm' \
  -o -name '*.sqlite' -o -name '*.sqlite3' -o -name '*.db3' \) -type f -delete 2>/dev/null || true
rm -rf "$APP_COPY/data"

# Snapshot the source before anything mutates it: Harbor keeps only /logs.
mkdir -p "$LOG_DIR/app-source"
cp -a "$APP_COPY/." "$LOG_DIR/app-source/" 2>/dev/null || true

# The seed artifacts the brief points at, byte-identical to the ones baked into
# the agent image and hashed in task.toml. Staged to /assets AND /tmp/assets
# even though the brief says copy them into /app.
mkdir -p "$SEED_DST" /tmp/assets/artifacts
cp -a "$SEED_SRC"/. "$SEED_DST/"
cp -a "$SEED_SRC"/. /tmp/assets/artifacts/
chmod a+r "$SEED_DST"/* /tmp/assets/artifacts/* 2>/dev/null || true

# Locate the real app root: agents nest their trees, so score candidates by
# marker files rather than assuming the top level.
find_app_root() {
  local best="$APP_COPY" best_score=-1
  while IFS= read -r dir; do
    local score=0
    [[ -f "$dir/APP_MANIFEST.md" ]] && score=$((score + 5))
    [[ -f "$dir/package.json" ]] && score=$((score + 3))
    [[ -d "$dir/src" ]] && score=$((score + 1))
    [[ -f "$dir/vite.config.js" || -f "$dir/vite.config.ts" ]] && score=$((score + 1))
    if (( score > best_score )); then best_score=$score; best="$dir"; fi
  done < <(find "$APP_COPY" -maxdepth 3 -type d -not -path '*/node_modules/*' 2>/dev/null)
  printf '%s\n' "$best"
}
APP_ROOT="$(find_app_root)"
echo "app root: $APP_ROOT"
mkdir -p "$APP_ROOT/artifacts"
cp -a "$SEED_SRC"/. "$APP_ROOT/artifacts/"
chmod a+r "$APP_ROOT/artifacts/"* 2>/dev/null || true

# Read the install and start commands out of the manifest's fenced blocks, so
# the verifier stays agnostic about how the submission builds itself.
# Prefer an explicit `bash install` / `bash start` tag. If the agent labelled
# the fences as plain ```bash (Haiku did), the first untagged block is install
# and the second is start.
manifest_block() {
  local tag="$1" file="$APP_ROOT/APP_MANIFEST.md"
  [[ -f "$file" ]] || return 1
  python3 - "$file" "$tag" <<'PY'
import re, sys
text = open(sys.argv[1], encoding="utf-8").read()
tag = sys.argv[2]
blocks = re.findall(r"^```[ ]*bash[ ]*([^\n`]*)\n(.*?)^```[ ]*$", text, re.M | re.S)
tagged = [(label.strip(), body) for label, body in blocks]
for label, body in tagged:
    if label == tag:
        sys.stdout.write(body)
        sys.exit(0)
unlabeled = [body for label, body in tagged if label == ""]
if tag == "install" and unlabeled:
    sys.stdout.write(unlabeled[0])
elif tag == "start" and len(unlabeled) >= 2:
    sys.stdout.write(unlabeled[1])
PY
}

INSTALL_CMD="$(manifest_block install || true)"
START_CMD="$(manifest_block start || true)"
[[ -n "${INSTALL_CMD//[[:space:]]/}" ]] || INSTALL_CMD='npm install --offline --no-audit --no-fund --loglevel=error'
[[ -n "${START_CMD//[[:space:]]/}" ]] || START_CMD='npm start'

# NODE_ENV=production makes npm skip devDependencies, which is exactly where a
# Vite/React build toolchain lives. Strip it for both phases.
unset NODE_ENV

# Node 22 keeps node:sqlite behind this flag. Harmless for native sqlite
# drivers; required if the submission imported node:sqlite but forgot it on
# `npm start`.
export NODE_OPTIONS="${NODE_OPTIONS:-} --experimental-sqlite"

# Scoring never talks to the npm registry. The verifier allowlist is the
# judge provider only; the card desk is local and tarballs come from
# /opt/npm-offline baked at image build.
export npm_config_cache="${npm_config_cache:-/opt/npm-offline}"
export npm_config_offline=true
export npm_config_audit=false
export npm_config_fund=false

# Submission-authored install/build is untrusted the same way start is.
# Running it as root would read /tests through chmod go-rwx and could write
# /logs/verifier. Drop to uid 10001 before that shell runs. stdout is still
# opened by this root shell, so the process does not need write access to /logs.
# timeout must wrap runuser (not a bash function): GNU timeout cannot exec functions.
if id grader >/dev/null 2>&1; then
  mkdir -p /opt/grader
  chown -R grader:grader "$APP_ROOT" /opt/grader 2>/dev/null || true
  chmod -R a+rwX /opt/npm-offline 2>/dev/null || true
fi

echo "--- install ---"
if ! timeout "$INSTALL_TIMEOUT" runuser -u grader -- env HOME=/opt/grader \
      NODE_OPTIONS="${NODE_OPTIONS:-}" \
      npm_config_cache="${npm_config_cache:-/opt/npm-offline}" \
      npm_config_offline=true \
      npm_config_audit=false \
      npm_config_fund=false \
      bash -lc "cd '$APP_ROOT' && $INSTALL_CMD" \
      > "$LOG_DIR/install.log" 2>&1; then
  echo "install/build failed; see install.log" >&2
  tail -40 "$LOG_DIR/install.log" >&2 || true
  # Almost always this is a dependency outside the frozen pin: the offline cache
  # does not carry it, so npm ci exits non-zero. Abandoning here scores a
  # possibly-correct app zero without a judge ever seeing it. Stage the resolved
  # frozen tree and carry on; an app that genuinely needs the missing package
  # fails on its own merits in front of the judge instead.
  if [[ -d /opt/drawbill-deps/node_modules ]]; then
    echo "staging the frozen dependency tree and judging anyway" >&2
    rm -rf "$APP_ROOT/node_modules"
    cp -a /opt/drawbill-deps/node_modules "$APP_ROOT/node_modules" 2>/dev/null || true
    chmod -R a+rX "$APP_ROOT/node_modules" 2>/dev/null || true
  fi
  if [[ ! -d "$APP_ROOT/node_modules" ]]; then
    write_zero_reward
    exit 0
  fi
fi

# Agents sometimes put only `npm install` in the install fence and never run
# Vite. A missing bundle then looks like a dead app. Build if the config is
# there and dist/ is not.
if [[ -f "$APP_ROOT/vite.config.js" || -f "$APP_ROOT/vite.config.ts" ]]; then
  if [[ ! -f "$APP_ROOT/dist/index.html" ]]; then
    echo "--- vite build ---"
    if ! timeout "$BUILD_TIMEOUT" runuser -u grader -- env HOME=/opt/grader \
          NODE_OPTIONS="${NODE_OPTIONS:-}" \
          npm_config_cache="${npm_config_cache:-/opt/npm-offline}" \
          npm_config_offline=true \
          npm_config_audit=false \
          npm_config_fund=false \
          bash -lc "cd '$APP_ROOT' && npm run build" \
          >> "$LOG_DIR/install.log" 2>&1; then
      echo "vite build failed; see install.log" >&2
      tail -40 "$LOG_DIR/install.log" >&2 || true
      write_zero_reward
      exit 0
    fi
  fi
fi

# The brief tells agents to put the app in /app. Many of them hardcode that
# path for dist/, SQLite and the seed. We built a clean copy under /tmp so the
# agent's node_modules and bundle are not executed as received; now put the
# built tree back so those /app paths resolve. A GPT-5.4-mini submission
# listened on 3000 but served /app/dist while we had started it from /tmp, so
# GET / was 500 and urlopen treated that as "the app never came up".
if [[ "$APP_ROOT" != "$APP_SRC" ]]; then
  echo "--- sync built app to $APP_SRC ---"
  find "$APP_SRC" -mindepth 1 -maxdepth 1 -exec rm -rf {} + 2>/dev/null || true
  cp -a "$APP_ROOT"/. "$APP_SRC/"
  APP_ROOT="$APP_SRC"
fi
mkdir -p "$APP_ROOT/artifacts"
cp -a "$SEED_SRC"/. "$APP_ROOT/artifacts/"
chmod a+r "$APP_ROOT/artifacts/"* 2>/dev/null || true

# Starting and stopping are functions because grading restarts the app between
# judge groups; see the judging step below.
#
# The judge toolchain stays root. Install, optional Vite build, and the
# submitted Node process all run as uid 10001 (grader) so agent-authored
# shell is not the user that can read /tests or write /logs/verifier.
# Stdout is still opened by this root shell.
start_app() {
  # Ticks of 0.5s to wait for the port to answer. The first boot gets
  # BOOT_TICKS; a restart between judge groups gets the much shorter
  # RESTART_TICKS, because a process that already booted once comes back in
  # seconds and an unbounded poll here used to sit outside the judging budget.
  local poll_ticks="${1:-$BOOT_TICKS}"
  local launch=(env PORT="$APP_PORT" HOME="$APP_ROOT" NODE_OPTIONS="${NODE_OPTIONS:-}"
    VENDOR_PORT="$VENDOR_PORT"
    VENDOR_BASE_URL="$VENDOR_BASE_URL"
    VENDOR_TOKEN="${VENDOR_TOKEN:-db-vendor-dev}"
    NOTICE_API_KEY="${NOTICE_API_KEY:-db-notice-dev}"
    BASE_URL="${BASE_URL:-http://localhost:3000}"
    APP_PUBLIC_URL="${APP_PUBLIC_URL:-http://localhost:3000}"
    APP_PUBLIC_PORT="${APP_PUBLIC_PORT:-3000}"
    SEED_DIR="${SEED_DIR:-$APP_ROOT/artifacts}")
  # The brief says ops wipes /app/data, and this verifier does exactly that
  # between groups, so the directory is genuinely absent at boot. Stand the
  # empty directory back up before launching: a submission that opens
  # /app/data/drawbill.db without creating the directory first dies with
  # "unable to open database file" before a single criterion can be judged, and
  # an empty directory still has no ledger in it, so first-boot seeding and the
  # durability checks are unchanged.
  mkdir -p "$APP_ROOT/data"
  if id grader >/dev/null 2>&1; then
    chown -R grader:grader "$APP_ROOT" 2>/dev/null || true
  fi
  if id grader >/dev/null 2>&1 && command -v runuser >/dev/null 2>&1; then
    launch=(runuser -u grader -- "${launch[@]}")
  fi
  setsid "${launch[@]}" bash -lc "cd '$APP_ROOT' && $START_CMD" >> "$LOG_DIR/app.log" 2>&1 &
  APP_PID="$!"

  local ready=0
  for _ in $(seq 1 "$poll_ticks"); do
    if python3 - "$APP_PORT" <<'PY' >/dev/null 2>&1
import socket, sys, urllib.error, urllib.request
port = int(sys.argv[1])
# Any HTTP status means the process is serving. urlopen raising HTTPError on
# 4xx/5xx used to mark a live app as "did not answer".
for host in ("127.0.0.1", "localhost", "::1"):
    try:
        urllib.request.urlopen(f"http://{host}:{port}/", timeout=2)
        sys.exit(0)
    except urllib.error.HTTPError:
        sys.exit(0)
    except Exception:
        pass
    try:
        with socket.create_connection((host, port), 2):
            sys.exit(0)
    except Exception:
        pass
sys.exit(1)
PY
    then
      ready=1
      break
    fi
    sleep 0.5
  done
  [[ "$ready" == "1" ]]
}

stop_app() {
  if [[ -n "$APP_PID" ]]; then
    kill -- -"$APP_PID" 2>/dev/null || true
    wait "$APP_PID" 2>/dev/null || true
    APP_PID=""
  fi
}

# The brief requires seeding on first boot and forbids re-seeding afterwards, so
# removing /app/data plus sqlite files returns a conforming submission to seed.
reset_app() {
  stop_app
  rm -rf "$APP_ROOT/data" "$APP_SRC/data"
  find "$APP_ROOT" "$APP_SRC" \( -name '*.db' -o -name '*.db-wal' -o -name '*.db-shm' \
    -o -name '*.sqlite' -o -name '*.sqlite3' -o -name '*.db3' \) -type f -delete 2>/dev/null || true
  mkdir -p "$APP_ROOT/artifacts"
  cp -a "$SEED_SRC"/. "$APP_ROOT/artifacts/" 2>/dev/null || true
  ensure_vendors_alive || true
  reset_vendors
  start_app "$RESTART_TICKS"
}

# Clearing the plant between groups needs the desk token: /audit/reset is behind
# requireToken, so an unauthenticated POST is refused with a 401. It used to be
# sent bare and the failure hidden behind `|| true`, which left the call ledger,
# the copy desks and the card sessions accumulating across every judge group --
# and a stale ledger silently satisfies the criteria that ask whether THIS
# session's quote called a desk. A reset that does not happen is reported here
# rather than swallowed.
reset_vendors() {
  local auth="Authorization: Bearer ${VENDOR_TOKEN:-db-vendor-dev}"
  if curl -fsS -X POST -H "$auth" "http://127.0.0.1:${VENDOR_PORT}/audit/reset" >/dev/null 2>&1; then
    return 0
  fi
  echo "the plant desks did not accept the reset; the call ledger may carry over" >&2
  return 1
}

# Separate verifier image: plant desks are not the agent entrypoint. Start them
# from /tests/__vendors__ when 3101 is not already answering.
ensure_vendors() {
  if curl -fsS "http://127.0.0.1:${VENDOR_PORT}/health" >/dev/null 2>&1; then
    echo "vendor desks already healthy on ${VENDOR_PORT}"
    reset_vendors
    return 0
  fi
  if [[ ! -f /tests/__vendors__/start.sh ]]; then
    echo "no vendor desk launcher at /tests/__vendors__/start.sh" >&2
    return 1
  fi
  echo "--- starting vendor desks on ${VENDOR_PORT} ---"
  VENDOR_PORT="$VENDOR_PORT" \
    VENDOR_TOKEN="${VENDOR_TOKEN:-db-vendor-dev}" \
    NOTICE_API_KEY="${NOTICE_API_KEY:-db-notice-dev}" \
    setsid bash /tests/__vendors__/start.sh >> "$LOG_DIR/vendors.log" 2>&1 &
  VENDOR_PID="$!"
  local ready=0
  for _ in $(seq 1 40); do
    if curl -fsS "http://127.0.0.1:${VENDOR_PORT}/health" >/dev/null 2>&1; then
      ready=1
      break
    fi
    sleep 0.25
  done
  [[ "$ready" == "1" ]]
}

# The desks have to be answering for EVERY judge group, not just the first.
# A session that finds 3101 dead reads a live submission as one that never
# asked the plant, and scores desk questions it did in fact ask as misses. This
# is checked before each group and the desks are restarted if they are gone.
ensure_vendors_alive() {
  if curl -fsS "http://127.0.0.1:${VENDOR_PORT}/health" >/dev/null 2>&1; then
    return 0
  fi
  echo "plant vendor desks stopped answering; bringing them back" >&2
  if [[ -n "$VENDOR_PID" ]]; then
    kill -- -"$VENDOR_PID" 2>/dev/null || true
    kill "$VENDOR_PID" 2>/dev/null || true
    wait "$VENDOR_PID" 2>/dev/null || true
    VENDOR_PID=""
  fi
  ensure_vendors
}

echo "--- vendors ---"
if ! ensure_vendors; then
  echo "plant vendor desks did not answer on port $VENDOR_PORT" >&2
  tail -40 "$LOG_DIR/vendors.log" >&2 || true
  exit 0
fi

echo "--- start ---"
if ! start_app; then
  echo "the application did not answer on port $APP_PORT" >&2
  tail -40 "$LOG_DIR/app.log" >&2 || true
  exit 0
fi

# Judge credentials. The codex CLI is pointed at OpenRouter by the
# /root/.codex/config.toml baked into the verifier image, whose provider block
# reads OPENROUTER_API_KEY. RewardKit additionally runs `codex login
# --with-api-key`, which reads OPENAI_API_KEY and is skipped silently when that
# variable is unset — leaving codex unauthenticated. Mirroring the one key we
# are given into both names satisfies the login step and the provider block.
if [[ -n "${OPENROUTER_API_KEY:-}" && -z "${OPENAI_API_KEY:-}" ]]; then
  export OPENAI_API_KEY="$OPENROUTER_API_KEY"
fi
if [[ -z "${OPENROUTER_API_KEY:-}" && -z "${OPENAI_API_KEY:-}" ]]; then
  echo "no judge credential in the environment; cannot grade" >&2
  exit 0
fi

# Belt and braces: recreate the codex provider config if the image layer is
# missing it, so the judge still reaches OpenRouter rather than api.openai.com.
CODEX_HOME="${CODEX_HOME:-/root/.codex}"
mkdir -p "$CODEX_HOME"
if ! grep -q 'model_providers.openrouter' "$CODEX_HOME/config.toml" 2>/dev/null; then
  {
    printf '%s\n' 'model_provider = "openrouter"'
    printf '%s\n' ''
    printf '%s\n' '[model_providers.openrouter]'
    printf '%s\n' 'name = "OpenRouter"'
    printf '%s\n' 'base_url = "https://openrouter.ai/api/v1"'
    printf '%s\n' 'env_key = "OPENROUTER_API_KEY"'
    printf '%s\n' 'wire_api = "responses"'
  } >> "$CODEX_HOME/config.toml"
fi

echo "--- judging ---"
# Every judge group is graded against a freshly seeded application.
#
# The groups share one live app and one SQLite file, and their prompts overlap on
# the same jobs. A pay session that posts Harborview App 2, or a downtown session
# that files a first paper, leaves the next prompt looking at books the seed no
# longer describes. Graded in a single pass, later groups scored zero on records
# an earlier group had already spent. Restarting the app with its database
# removed between groups gives every prompt the seed it was written against.
# RewardKit still does all of the grading; this only decides what it is looking
# at. The plant copy desks are reset on the same boundary.
# The one group that is restarted rather than reseeded. It has to sort
# immediately after the group whose session writes the books it grades, which
# LC_ALL=C gives us for free: nothing sorts between judge_desks.toml and
# judge_desks_restart.toml. Both names are asserted below.
RESTART_GROUP="judge_desks_restart.toml"
RESTART_WRITER="judge_desks.toml"

DIMS="$LOG_DIR/dimensions.json"
GROUP_ROOT="/tmp/judge-groups"
rm -rf "$GROUP_ROOT"
mkdir -p "$GROUP_ROOT"

# A dimension is a directory holding at least one judge file; anything else
# under /tests (assets, coverage.json) is not one.
#
# Constraints first: that session is what actually gets Playwright MCP. Render
# first used to miss the browser on a cold Codex start, score the gate 0, and
# zero a mid-band app the later sessions had already graded.
JUDGE_GROUPS=()
for dim in constraints render functional polish; do
  dim_dir="/tests/${dim}/"
  [[ -d "$dim_dir" ]] || continue
  # LC_ALL=C so functional/judge_desks.toml always runs immediately before
  # functional/judge_desks_restart.toml: the desks session files and pays the
  # April paper, and the restart session grades those books coming back off
  # disk. Nothing sorts between the two names.
  while IFS= read -r toml; do
    [[ -e "$toml" ]] || continue
    # Schema-only judge.toml next to judge_*.toml is not a scored group.
    if [[ "$(basename "$toml")" == "judge.toml" ]] && ls "$dim_dir"judge_*.toml >/dev/null 2>&1; then
      continue
    fi
    JUDGE_GROUPS+=("${dim}|${toml}")
  done < <(LC_ALL=C printf '%s\n' "$dim_dir"judge*.toml | LC_ALL=C sort)
done
if (( ${#JUDGE_GROUPS[@]} == 0 )); then
  echo "no judge groups found under /tests" >&2
  exit 0
fi

# The restart pair has to be present and adjacent, or the group that grades a
# process restart is reseeded like every other one and its criteria quietly stop
# discriminating -- a wipe-and-reseed app and a durable one would look the same.
# A rename that breaks the pair is a task bug, so it is reported here rather
# than left to be inferred from the scores.
restart_at=-1
writer_at=-1
for i in "${!JUDGE_GROUPS[@]}"; do
  case "$(basename "${JUDGE_GROUPS[$i]#*|}")" in
    "$RESTART_GROUP")  restart_at="$i" ;;
    "$RESTART_WRITER") writer_at="$i" ;;
  esac
done
if (( restart_at < 0 || writer_at < 0 )); then
  echo "the restart pair is incomplete: expected $RESTART_WRITER and $RESTART_GROUP under /tests" >&2
elif (( restart_at != writer_at + 1 )); then
  echo "$RESTART_GROUP does not immediately follow $RESTART_WRITER; it will grade books no session wrote" >&2
fi

# Judging runs against the one absolute deadline stamped at entry, minus the
# tail the score merge needs. Install, the optional Vite build and the first
# readiness poll have already been spent out of the same clock, so whatever is
# left here is genuinely available and nothing downstream can push past the
# verifier timeout.
#
# The per-group share is recomputed every iteration as "what is left divided by
# the groups still to run". That does two things the old fixed budget did not:
# the app restart and ALL retry attempts are charged inside the group's own
# GROUP_END, so a retry can no longer starve the groups after it; and a group
# that finishes early donates its slack to the ones that follow.
JUDGE_END=$(( SCRIPT_START + VERIFIER_TIMEOUT_SEC - TAIL_RESERVE ))
TOTAL_GROUPS=${#JUDGE_GROUPS[@]}
JUDGE_LEFT=$(( JUDGE_END - $(date +%s) ))
echo "judging $TOTAL_GROUPS groups in ${JUDGE_LEFT}s (deadline leaves ${TAIL_RESERVE}s to score)"

GROUP_N=0
for entry in "${JUDGE_GROUPS[@]}"; do
  DIM="${entry%%|*}"
  TOML="${entry#*|}"
  GROUP_N=$((GROUP_N + 1))

  # This group's share of what is actually left, fixed before the restart so
  # the restart is charged to it rather than sitting outside the budget.
  NOW="$(date +%s)"
  GROUPS_LEFT=$(( TOTAL_GROUPS - GROUP_N + 1 ))
  LEFT=$(( JUDGE_END - NOW ))
  if (( LEFT <= 150 )); then
    echo "the judging deadline is reached; $GROUPS_LEFT group(s) will be left out" >&2
    break
  fi
  GROUP_BUDGET=$(( LEFT / GROUPS_LEFT ))
  GROUP_END=$(( NOW + GROUP_BUDGET ))

  SLUG="$(printf '%02d-%s-%s' "$GROUP_N" "$DIM" "$(basename "$TOML" .toml)")"
  WORK="$GROUP_ROOT/$SLUG"
  OUT="$WORK/out"
  mkdir -p "$OUT"

  # A tests tree holding this group alone. The whole tree is copied first so any
  # shared file a dimension reads is still beside it, then the other dimensions
  # and the sibling judge files are removed so RewardKit grades exactly one.
  cp -a /tests "$WORK/tests"
  rm -f "$WORK/tests/reward.toml"
  for other in "$WORK/tests"/*/; do
    if [[ "$(basename "$other")" != "$DIM" ]] && ls "$other"judge*.toml >/dev/null 2>&1; then
      rm -rf "$other"
    fi
  done
  for sibling in "$WORK/tests/$DIM"/judge*.toml; do
    [[ -e "$sibling" ]] || continue
    [[ "$(basename "$sibling")" == "$(basename "$TOML")" ]] || rm -f "$sibling"
  done
  # Carried alongside the scores so the merge below can weight this group the
  # way RewardKit would have.
  cp -a "$TOML" "$OUT/judge.toml"
  printf '%s\n' "$DIM" > "$OUT/dimension.txt"

  echo "--- judging $SLUG ---"
  ensure_vendors_alive || echo "the plant desks did not come back before $SLUG" >&2
  if [[ "$(basename "$TOML")" == "$RESTART_GROUP" ]]; then
    # Leave /app/data/drawbill.db in place so this group grades a process restart
    # of the books the group before it wrote.
    stop_app
    if ! start_app "$RESTART_TICKS"; then
      echo "the application did not come back before $SLUG" >&2
      tail -40 "$LOG_DIR/app.log" >&2 || true
      write_zero_reward
      exit 0
    fi
  elif ! reset_app; then
    echo "the application did not come back before $SLUG" >&2
    tail -40 "$LOG_DIR/app.log" >&2 || true
    exit 0
  fi

  # Leftover Chromium from the previous group is why Codex has dropped the
  # Playwright MCP server and scored a whole dimension "unable to evaluate".
  pkill -f 'chrome|chromium|playwright-mcp' >/dev/null 2>&1 || true
  sleep 2

  # Run RewardKit through the patch shim rather than the bare CLI: the shim
  # points codex at OpenRouter, tells it where the browser is and pre-approves
  # the Playwright MCP tools, none of which RewardKit does on its own. Retries
  # absorb a gateway stumble OR a session that finished at 0 because Playwright
  # never registered (that used to be recorded as a real zero and gated the
  # trial).
  GROUP_OK=0
  for attempt in 1 2 3; do
    # Every attempt is sliced against THIS group's deadline, so all three share
    # the one budget the group was given and cannot borrow from later groups.
    SLICE=$(( GROUP_END - $(date +%s) ))
    if (( SLICE <= 120 )); then
      echo "this group's budget is spent; not starting $SLUG attempt $attempt" >&2
      break
    fi
    pkill -f 'chrome|chromium|playwright-mcp' >/dev/null 2>&1 || true
    rm -f "$OUT/dimensions.json" "$OUT/reward-details.json"
    if timeout "$SLICE" python3 /opt/judge/run_judge.py "$WORK/tests" "$OUT/dimensions.json"; then
      if python3 - "$WORK" <<'PY'; then
import json, os, sys
root = sys.argv[1]
needles = (
    "unable to evaluate",
    "could not evaluate",
    "no playwright",
    "playwright mcp",
    "browser tool is available",
    "browser tools are not",
    "browser tools is not",
    "not available in the provided tool",
    "provided tool set",
    "not in your tool set",
    "not in the provided tool",
)
reasons = []

def walk(obj):
    if isinstance(obj, dict):
        if "reasoning" in obj:
            reasons.append(str(obj.get("reasoning") or ""))
        for v in obj.values():
            walk(v)
    elif isinstance(obj, list):
        for v in obj:
            walk(v)

for dirpath, _, files in os.walk(root):
    for name in files:
        if not name.endswith(".json"):
            continue
        path = os.path.join(dirpath, name)
        try:
            walk(json.load(open(path, encoding="utf-8")))
        except Exception:
            pass
if reasons:
    reasons = [r for r in reasons if r.strip()]
if reasons and all(any(n in r.lower() for n in needles) for r in reasons):
    sys.exit(1)
sys.exit(0)
PY
        GROUP_OK=1
        break
      fi
      echo "$SLUG attempt ${attempt}/3 finished but was unevaluable (no Playwright tools)" >&2
    else
      echo "$SLUG attempt ${attempt}/3 did not complete within ${SLICE}s" >&2
    fi
    sleep 5
  done
  # A group that never produced a score is left out of its dimension by the
  # merge below rather than counted as zero: a judge that could not be reached
  # is not evidence about the submission. The whole run is only abandoned if
  # nothing was graded at all.
  if [[ "$GROUP_OK" != "1" ]]; then
    rm -f "$OUT/dimensions.json"
    echo "the judge did not complete for $SLUG; that group will be left out" >&2
  fi

  # Keep the evidence: Harbor retains only /logs.
  for f in "$OUT"/trajectory.*.jsonl; do
    [[ -e "$f" ]] || continue
    cp -a "$f" "$LOG_DIR/$SLUG.$(basename "$f")" 2>/dev/null || true
  done
done

echo "--- scoring ---"
# render and constraints are gates, not scored dimensions: a submission that
# does not render, or that enforces its rules only in the interface, scores
# zero however good the rest of it looks. Quality is then 60% functional
# behaviour and 40% polish:
#
#   0 if render < 1.0 or constraints < 1.0 else 0.6*functional + 0.4*polish
#
# Kept in one place so the published formula and the number Harbor reads cannot
# drift apart. The formula stays a comment here and out of reward.json: Harbor
# parses every value in that file as a number, so shipping it as a field made
# the trial die in VerifierResult validation and the whole run was recorded as
# an error rather than as a score.
#
# Because each group was graded on its own, the four dimension figures are
# rebuilt here with the same weighting RewardKit applies: a criterion-weighted
# mean within a group, then a group-weighted mean across the groups of a
# dimension, taking each group's weight from the `weight` in its [judge] table.
python3 - "$GROUP_ROOT" "$DIMS" "$LOG_DIR/reward-details.json" \
         "$LOG_DIR/reward.json" "$LOG_DIR/reward.txt" <<'PYEOF'
import glob, json, os, sys, tomllib

group_root, dims_path, details_path, reward_json, reward_txt = sys.argv[1:6]

UNEVAL = (
    "unable to evaluate",
    "could not evaluate",
    "no playwright",
    "playwright mcp",
    "browser tool is available",
    "browser tools are not",
    "browser tools is not",
    "not available in the provided tool",
    "provided tool set",
    "not in your tool set",
    "not in the provided tool",
)

def reasons_unevaluable(root):
    reasons = []
    def walk(obj):
        if isinstance(obj, dict):
            if "reasoning" in obj:
                reasons.append(str(obj.get("reasoning") or ""))
            for v in obj.values():
                walk(v)
        elif isinstance(obj, list):
            for v in obj:
                walk(v)
    for dirpath, _, files in os.walk(root):
        for name in files:
            if not name.endswith(".json"):
                continue
            try:
                walk(json.load(open(os.path.join(dirpath, name), encoding="utf-8")))
            except Exception:
                pass
    reasons = [r for r in reasons if r.strip()]
    if not reasons:
        return False
    return all(any(n in r.lower() for n in UNEVAL) for r in reasons)

def read_json(path):
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    except Exception as exc:                  # noqa: BLE001
        print(f"could not read {path}: {exc}", file=sys.stderr)
        return None

groups = {}          # dimension -> list of (weight, score)
details = {}         # dimension -> list of RewardKit detail blocks

for out in sorted(glob.glob(os.path.join(group_root, "*", "out"))):
    dim_file = os.path.join(out, "dimension.txt")
    if not os.path.exists(dim_file):
        continue
    with open(dim_file, encoding="utf-8") as fh:
        dim = fh.read().strip()

    weight = 1.0
    try:
        with open(os.path.join(out, "judge.toml"), "rb") as fh:
            weight = float(tomllib.load(fh).get("judge", {}).get("weight", 1.0))
    except Exception as exc:                  # noqa: BLE001
        print(f"could not read the judge weight for {dim} in {out}: {exc}", file=sys.stderr)
    if weight <= 0:
        weight = 1.0

    scores = read_json(os.path.join(out, "dimensions.json")) or {}
    value = scores.get(dim)
    # A group that produced no number is a judge that did not answer, not an
    # application that failed; it is left out so it cannot dilute the dimension.
    if not isinstance(value, (int, float)):
        print(f"no score for {dim} in {out}; leaving that group out", file=sys.stderr)
        continue
    value = float(value)
    # A render 0 whose every reason is "no Playwright tools" is the cold-start
    # miss that zeroed gpt-5.4-mini while constraints/functional/polish graded
    # the same live app in the mid band. Do not treat that as an application fail.
    if dim == "render" and value < 1.0 and reasons_unevaluable(os.path.dirname(out)):
        print(f"render was unevaluable (no Playwright); leaving that group out",
              file=sys.stderr)
        continue
    groups.setdefault(dim, []).append((weight, value))

    block = read_json(os.path.join(out, "reward-details.json")) or {}
    found = block.get(dim)
    if isinstance(found, dict):
        found = [found]
    if isinstance(found, list):
        details.setdefault(dim, []).extend(found)

# Nothing graded at all is an unreachable judge, not a broken submission, and is
# reported as ungraded so it does not enter the statistics as a zero.
if not groups:
    print("no judge group produced a score; reporting ungraded rather than zero",
          file=sys.stderr)
    with open(reward_json, "w", encoding="utf-8") as fh:
        json.dump({"reward": 0.0, "graded": 0, "no_op": 1}, fh, indent=2)
        fh.write("\n")
    with open(reward_txt, "w", encoding="utf-8") as fh:
        fh.write("0.0\n")
    raise SystemExit(0)

# A gate dimension that never produced a usable score is infrastructure, not a
# failed application. Recording it as reward=0 graded=1 is how a mid-band
# model was zeroed after Playwright dropped out of the last session.
#
# If constraints already passed, sign-in and seeded data were observed in the
# browser — that is the render gate. Infer render=1.0 rather than ungrading a
# trial the other three dimensions already scored.
def dimension(name):
    parts = groups.get(name) or []
    total = sum(w for w, _ in parts)
    if not total:
        return 0.0
    return sum(w * s for w, s in parts) / total

if "render" not in groups:
    cons_parts = groups.get("constraints") or []
    cons = dimension("constraints") if cons_parts else None
    if cons is not None and cons >= 1.0:
        print("inferring render=1.0 from a passing constraints gate", file=sys.stderr)
        groups["render"] = [(1.0, 1.0)]
    else:
        print("a gate dimension produced no usable score; reporting ungraded",
              file=sys.stderr)
        with open(reward_json, "w", encoding="utf-8") as fh:
            json.dump({"reward": 0.0, "graded": 0, "no_op": 1}, fh, indent=2)
            fh.write("\n")
        with open(reward_txt, "w", encoding="utf-8") as fh:
            fh.write("0.0\n")
        raise SystemExit(0)

if "constraints" not in groups:
    print("a gate dimension produced no usable score; reporting ungraded",
          file=sys.stderr)
    with open(reward_json, "w", encoding="utf-8") as fh:
        json.dump({"reward": 0.0, "graded": 0, "no_op": 1}, fh, indent=2)
        fh.write("\n")
    with open(reward_txt, "w", encoding="utf-8") as fh:
        fh.write("0.0\n")
    raise SystemExit(0)

dims = {name: round(dimension(name), 4)
        for name in ("render", "constraints", "functional", "polish")}

with open(dims_path, "w", encoding="utf-8") as fh:
    json.dump(dims, fh, indent=2)
    fh.write("\n")
with open(details_path, "w", encoding="utf-8") as fh:
    json.dump(details, fh, indent=2)
    fh.write("\n")

render, constraints = dims["render"], dims["constraints"]
functional, polish = dims["functional"], dims["polish"]

# A gate has to be met in full: every criterion in it passed.
gate_passed = render >= 1.0 and constraints >= 1.0
reward = round(0.6 * functional + 0.4 * polish, 4) if gate_passed else 0.0

# Every value Harbor reads out of this file has to be a number.
payload = {
    "reward": reward,
    "render": render,
    "constraints": constraints,
    "functional": functional,
    "polish": polish,
    "gate_passed": 1 if gate_passed else 0,
    "graded": 1,
    "no_op": 0,
}
with open(reward_json, "w", encoding="utf-8") as fh:
    json.dump(payload, fh, indent=2)
    fh.write("\n")
with open(reward_txt, "w", encoding="utf-8") as fh:
    fh.write(f"{reward}\n")
print(json.dumps(payload, indent=2))
PYEOF
REWARD_FINAL=1
