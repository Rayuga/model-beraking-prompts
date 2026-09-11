#!/usr/bin/env bash
# Boot the self-contained Boardloom stack inside the Harbor container:
#   1. start the SQLite-backed API on :4000 (empty schema; users register)
#   2. start Vite on :5173 (proxies /api + /health to the backend)
set -uo pipefail
cd "$(dirname "$0")"
APP_DIR="$(pwd)"

if [ ! -w "${HOME:-/nonexistent}" ]; then export HOME=/tmp; fi
export npm_config_cache="${HOME}/.npm-cache"
export XDG_CACHE_HOME="${HOME}/.cache"
mkdir -p "${npm_config_cache}" "${XDG_CACHE_HOME}" 2>/dev/null || true

NEED_RELOCATE=0
for d in "${APP_DIR}" "${APP_DIR}/backend" "${APP_DIR}/frontend"; do
  if ( : > "${d}/.perm_test" ) 2>/dev/null; then
    rm -f "${d}/.perm_test" 2>/dev/null || true
  else
    NEED_RELOCATE=1
  fi
done
if [ "${NEED_RELOCATE}" -eq 1 ]; then
  WORK_DIR="${HOME}/boardloom-app"
  echo "[start] app dir not fully writable -> relocating app to '${WORK_DIR}'"
  rm -rf "${WORK_DIR}"; mkdir -p "${WORK_DIR}"
  cp -a "${APP_DIR}/." "${WORK_DIR}/" 2>/dev/null || cp -R "${APP_DIR}/." "${WORK_DIR}/"
  APP_DIR="${WORK_DIR}"
  cd "${APP_DIR}"
fi

mkdir -p "${APP_DIR}/backend/data"
export SQLITE_PATH="${SQLITE_PATH:-${APP_DIR}/backend/data/boardloom.db}"
if [ "${BOARDLOOM_ADMIN_RESET:-1}" = "1" ]; then
  rm -f "${SQLITE_PATH}" "${SQLITE_PATH}-wal" "${SQLITE_PATH}-shm" "${SQLITE_PATH}-journal" 2>/dev/null || true
  echo "[start] verifier reset: cleared SQLite files"
fi
echo "[start] SQLite database: ${SQLITE_PATH}"

export PORT="${PORT:-4000}"
export BOARDLOOM_ADMIN_RESET="${BOARDLOOM_ADMIN_RESET:-1}"
if [ -f "${APP_DIR}/backend/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "${APP_DIR}/backend/.env" || { echo "[start] failed to load backend/.env (quote values with spaces or <>)"; exit 1; }
  set +a
fi

port_busy() {
  if command -v lsof >/dev/null 2>&1; then
    lsof -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
  else
    return 1
  fi
}

if port_busy "${PORT}"; then
  echo "[start] port ${PORT} is already in use (often a leftover Harbor/oracle Docker container)."
  echo "[start] free it with: docker ps --filter publish=${PORT} --format '{{.Names}}' | xargs -r docker stop"
  echo "[start] or run: PORT=4001 bash start.sh"
  exit 1
fi
if port_busy 5173; then
  echo "[start] port 5173 is already in use (often a previous Vite dev server)."
  echo "[start] free it with: lsof -ti :5173 | xargs kill"
  exit 1
fi

NPM_FLAGS="--no-audit --no-fund --prefer-offline --loglevel=error --ignore-scripts"
# The image carries every package under /opt/boardloom. There is no network, so
# that is where they come from.
npm_install_if_needed() {
  local dir="$1"; shift
  local half; half="$(basename "${dir}")"
  (
    cd "${dir}"
    [ -d node_modules ] && exit 0
    if [ -d "/opt/boardloom/${half}/node_modules" ]; then
      cp -a "/opt/boardloom/${half}/node_modules" node_modules && exit 0
    fi
    # Outside the container (a developer machine) there is no baked tree, so fall
    # back to a normal install. Inside either image this branch is never taken.
    if [ -f package-lock.json ]; then
      npm ci ${NPM_FLAGS} "$@"
    else
      npm install ${NPM_FLAGS} "$@"
    fi
  )
}

echo "[start] installing backend deps (if needed)"
npm_install_if_needed "${APP_DIR}/backend" &
BACKEND_INSTALL=$!
echo "[start] installing frontend deps (if needed)"
npm_install_if_needed "${APP_DIR}/frontend" --include=dev &
FRONTEND_INSTALL=$!

wait ${BACKEND_INSTALL}
echo "[start] launching API on :${PORT}"
cd "${APP_DIR}/backend"
npm start &
BACKEND_PID=$!

wait ${FRONTEND_INSTALL}
echo "[start] launching frontend on :5173"
cd "${APP_DIR}/frontend"
npm run dev -- --host 0.0.0.0 --port 5173 &
FRONTEND_PID=$!

trap 'kill ${BACKEND_PID} ${FRONTEND_PID} 2>/dev/null || true' INT TERM
wait
