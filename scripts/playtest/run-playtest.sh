#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-8081}"
LABEL="feature"
HEADED="false"
SKIP_SERVER="false"
URL=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --port)
      PORT="$2"
      shift 2
      ;;
    --label)
      LABEL="$2"
      shift 2
      ;;
    --headed)
      HEADED="true"
      shift
      ;;
    --skip-server)
      SKIP_SERVER="true"
      shift
      ;;
    --url)
      URL="$2"
      shift 2
      ;;
    *)
      echo "Unknown arg: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "${URL}" ]]; then
  URL="http://127.0.0.1:${PORT}"
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
SAFE_LABEL="$(echo "${LABEL}" | tr '[:space:]/' '__')"
RUN_DIR="output/playwright/${STAMP}-${SAFE_LABEL}"
mkdir -p "${RUN_DIR}"

SERVER_PID=""

cleanup() {
  if [[ -n "${SERVER_PID}" ]]; then
    kill "${SERVER_PID}" >/dev/null 2>&1 || true
    wait "${SERVER_PID}" 2>/dev/null || true
  fi
}
trap cleanup EXIT

if [[ "${SKIP_SERVER}" != "true" ]]; then
  echo "Starting Expo web on port ${PORT}..."
  npm run web -- --port "${PORT}" --non-interactive > "${RUN_DIR}/expo-web.log" 2>&1 &
  SERVER_PID="$!"

  echo "Waiting for ${URL} ..."
  for _ in $(seq 1 120); do
    if curl -fsS "${URL}" >/dev/null 2>&1; then
      echo "Web server is ready."
      break
    fi
    sleep 1
  done

  if ! curl -fsS "${URL}" >/dev/null 2>&1; then
    echo "Failed to reach ${URL}. See ${RUN_DIR}/expo-web.log" >&2
    exit 1
  fi
fi

PLAY_ARGS=(
  node scripts/playtest/playtest-routine.js
  --url "${URL}"
  --run-dir "${RUN_DIR}"
)

if [[ "${HEADED}" == "true" ]]; then
  PLAY_ARGS+=(--headed)
fi

"${PLAY_ARGS[@]}" | tee "${RUN_DIR}/runner-output.json"

echo "Playtest artifacts: ${RUN_DIR}"
