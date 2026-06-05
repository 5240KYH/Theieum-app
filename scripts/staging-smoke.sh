#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-${STAGING_BASE_URL:-http://localhost:3000}}"
BASE_URL="${BASE_URL%/}"

fail() {
  echo "FAIL: $1" >&2
  exit 1
}

curl_cmd() {
  if [ "${STAGING_INSECURE_TLS:-0}" = "1" ]; then
    curl -k "$@"
  else
    curl "$@"
  fi
}

status_code() {
  local url="$1"
  local label="$2"
  local code

  if ! code="$(curl_cmd -sS -o /dev/null -w '%{http_code}' "${url}")"; then
    fail "${label} request failed"
  fi

  printf '%s' "${code}"
}

headers_for() {
  local url="$1"
  local label="$2"
  local headers

  if ! headers="$(curl_cmd -sS -D - -o /dev/null "${url}")"; then
    fail "${label} request failed"
  fi

  printf '%s\n' "${headers}"
}

echo "Checking staging target: ${BASE_URL}"

FRONTEND_STATUS="$(status_code "${BASE_URL}/" "frontend /")"
if [ "${FRONTEND_STATUS}" != "200" ]; then
  fail "frontend / returned HTTP ${FRONTEND_STATUS}"
fi

MANIFEST_STATUS="$(status_code "${BASE_URL}/manifest.webmanifest" "manifest.webmanifest")"
if [ "${MANIFEST_STATUS}" != "200" ]; then
  fail "manifest.webmanifest returned HTTP ${MANIFEST_STATUS}"
fi

LOGIN_HEADERS="$(headers_for "${BASE_URL}/api/auth/login" "/api/auth/login")"
if ! printf '%s\n' "${LOGIN_HEADERS}" | grep -Eq '^HTTP/.* (401|405)'; then
  fail "/api/auth/login did not return HTTP 401 or 405 for GET"
fi

if ! printf '%s\n' "${LOGIN_HEADERS}" | grep -Eiq '^allow:.*POST'; then
  fail "/api/auth/login response does not expose Allow: POST"
fi

echo "PASS: frontend, manifest, and API proxy smoke checks passed"
