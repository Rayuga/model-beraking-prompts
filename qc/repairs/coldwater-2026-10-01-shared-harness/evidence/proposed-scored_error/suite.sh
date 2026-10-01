set -euo pipefail
LOG_DIR=/tmp/harness-proposal-controls/proposed-scored_error/logs
ZERO_REWARD_JSON='{"reward":0.0,"render":0.0,"constraints":0.0,"functional":0.0,"polish":0.0,"visual":0.0,"gates_passed":0,"floors_passed":0,"weighted_score":0.0,"graded":0,"no_op":1}'
write_zero_reward() {
  printf '0.0\n' > "$LOG_DIR/reward.txt"
  printf '%s\n' "$ZERO_REWARD_JSON" > "$LOG_DIR/reward.json"
  printf '{"tests":[],"tool":{"name":"rewardkit"},"summary":{"passed":0,"failed":0,"skipped":0,"total":0}}\n' > "$LOG_DIR/ctrf.json"
}

ensure_reward() {
  test -s "$LOG_DIR/reward.txt" || printf '0.0\n' > "$LOG_DIR/reward.txt"
  test -s "$LOG_DIR/reward.json" || printf '%s\n' "$ZERO_REWARD_JSON" > "$LOG_DIR/reward.json"
}


write_zero_reward
trap ensure_reward EXIT
run_suite() {
  mkdir -p "$LOG_DIR/$1"
  printf 'diagnostic-%s\n' "$1" > "$LOG_DIR/$1/rewardkit.log"
  if [[ "$1" == gates ]]; then
    printf '%s\n' '{"render": 1, "constraints": 1}' > "$LOG_DIR/gates/reward.json"
    return 0
  else
    printf '%s\n' '{"functional": 0.5, "polish": 1, "visual": 1}' > "$LOG_DIR/scored/reward.json"
    return 2
  fi
}
rm -rf "$LOG_DIR/scored"
if ! run_suite gates 1500; then
  exit 0
fi
gates_status=0
python3 /tmp/harness-proposal-controls/proposed-scored_error/tools/score.py "$LOG_DIR" || gates_status=$?
case "$gates_status" in
  0) ;;
  1) exit 0 ;;
  *) write_zero_reward; exit 0 ;;
esac

if ! run_suite scored 11100; then
  write_zero_reward
  exit 0
fi
python3 /tmp/harness-proposal-controls/proposed-scored_error/tools/score.py "$LOG_DIR" || write_zero_reward
