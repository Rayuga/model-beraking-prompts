#!/bin/bash
# Shared shop-network bring-up (Postgres + vendor desks on :3101).
set -euo pipefail

VENDOR_PORT="${VENDOR_PORT:-3101}"
VENDOR_SCRIPT="${VENDOR_SCRIPT:-/opt/gearvault-vendors/server.js}"
POSTGRES_START="${POSTGRES_START:-/opt/gearvault-postgres/start.sh}"
VENDOR_PID_FILE="/var/run/gearvault-vendors.pid"
VENDOR_LOG="/var/log/gearvault-vendors.log"

vendor_healthy() {
  curl -sf "http://127.0.0.1:${VENDOR_PORT}/health" >/dev/null 2>&1
}

ensure_postgres() {
  if pg_isready -h 127.0.0.1 -p 5432 -q 2>/dev/null; then
    echo "[shop-network] postgres already accepting connections"
    return 0
  fi
  if [[ -x "$POSTGRES_START" ]]; then
    if ! bash "$POSTGRES_START"; then
      echo "[shop-network] postgres start script failed (will retry later)" >&2
      return 1
    fi
  else
    echo "[shop-network] postgres start script missing at $POSTGRES_START" >&2
    return 1
  fi
}

ensure_vendors() {
  if vendor_healthy; then
    echo "[shop-network] vendor desks already healthy on :${VENDOR_PORT}"
    return 0
  fi

  if [[ -f "$VENDOR_PID_FILE" ]]; then
    old_pid="$(cat "$VENDOR_PID_FILE" 2>/dev/null || true)"
    if [[ -n "${old_pid}" ]] && kill -0 "${old_pid}" 2>/dev/null; then
      echo "[shop-network] vendor desk process ${old_pid} already running; waiting for health"
    else
      rm -f "$VENDOR_PID_FILE"
    fi
  fi

  if ! vendor_healthy; then
    if [[ ! -f "$VENDOR_SCRIPT" ]]; then
      echo "[shop-network] vendor script missing at $VENDOR_SCRIPT" >&2
      return 1
    fi
    echo "[shop-network] starting vendor desks: node $VENDOR_SCRIPT"
    nohup env VENDOR_PORT="$VENDOR_PORT" node "$VENDOR_SCRIPT" >>"$VENDOR_LOG" 2>&1 &
    echo $! >"$VENDOR_PID_FILE"
  fi

  local deadline=$((SECONDS + 45))
  until vendor_healthy; do
    if (( SECONDS >= deadline )); then
      echo "[shop-network] vendor desks did not become healthy on :${VENDOR_PORT}" >&2
      tail -n 40 "$VENDOR_LOG" 2>/dev/null || true
      return 1
    fi
    sleep 0.25
  done
  echo "[shop-network] vendor desks ready on http://127.0.0.1:${VENDOR_PORT}"
}

ensure_shop_network() {
  ensure_postgres
  ensure_vendors
}
