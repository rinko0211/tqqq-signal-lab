#!/usr/bin/env bash
set -euo pipefail

STATE_BRANCH="${OPS_STATE_BRANCH:-ops-state}"
STATE_PATHS=(
  "github-pages/public/data/forward-ledger.json"
  "github-pages/public/data/forward-summary.json"
  "github-pages/public/data/live-history.json"
  "github-pages/public/data/market-data.json"
  "github-pages/public/data/provider-attempt.json"
  "github-pages/public/data/signal.json"
  "github-pages/public/data/status.json"
  "github-pages/public/data/phase-5-forward-ledger.json"
  "github-pages/public/data/phase-5-forward-status.json"
  "github-pages/public/data/lifecycle-review.json"
  "github-pages/public/data/production-health-review.json"
  "github-pages/public/data/production-config.json"
  "github-pages/public/data/.failed"
)

emit_env() {
  local key="$1" value="$2"
  if [[ -n "${GITHUB_ENV:-}" ]]; then printf '%s=%s\n' "$key" "$value" >> "$GITHUB_ENV"; fi
}
emit_output() {
  local key="$1" value="$2"
  if [[ -n "${GITHUB_OUTPUT:-}" ]]; then printf '%s=%s\n' "$key" "$value" >> "$GITHUB_OUTPUT"; fi
}

fetch_state_branch() {
  git fetch --no-tags origin "refs/heads/$STATE_BRANCH:refs/remotes/origin/$STATE_BRANCH"
}

overlay() {
  fetch_state_branch
  local state_sha
  state_sha="$(git rev-parse "origin/$STATE_BRANCH")"
  for path in "${STATE_PATHS[@]}"; do
    mkdir -p "$(dirname "$path")"
    if git cat-file -e "origin/$STATE_BRANCH:$path" 2>/dev/null; then
      git show "origin/$STATE_BRANCH:$path" > "$path"
    else
      rm -f "$path"
    fi
  done
  emit_env OPS_STATE_BASE_SHA "$state_sha"
  emit_output state_sha "$state_sha"
  printf 'Overlayed operational state %s from %s\n' "$state_sha" "$STATE_BRANCH"
}

persist() {
  local message="${1:-Update operational state}"
  local expected="${OPS_STATE_BASE_SHA:-}"
  if [[ -z "$expected" ]]; then
    echo "::error::OPS_STATE_BASE_SHA is required; run overlay first"
    exit 1
  fi

  fetch_state_branch
  local current
  current="$(git rev-parse "origin/$STATE_BRANCH")"
  if [[ "$current" != "$expected" ]]; then
    echo "::error::ops-state advanced after overlay; refusing stale state write"
    exit 1
  fi

  local source_root tmp
  source_root="$(git rev-parse --show-toplevel)"
  tmp="$(mktemp -d)"
  cleanup() {
    git -C "$source_root" worktree remove --force "$tmp" >/dev/null 2>&1 || true
    rm -rf "$tmp"
  }
  trap cleanup EXIT

  git worktree add --detach "$tmp" "origin/$STATE_BRANCH" >/dev/null
  for path in "${STATE_PATHS[@]}"; do
    mkdir -p "$tmp/$(dirname "$path")"
    if [[ -e "$source_root/$path" ]]; then
      cp "$source_root/$path" "$tmp/$path"
    else
      rm -f "$tmp/$path"
    fi
  done

  git -C "$tmp" config user.name "github-actions[bot]"
  git -C "$tmp" config user.email "41898282+github-actions[bot]@users.noreply.github.com"
  git -C "$tmp" add -A -- "${STATE_PATHS[@]}"

  local changed
  changed="$(git -C "$tmp" diff --cached --name-only)"
  if [[ -n "$changed" ]]; then
    while IFS= read -r file; do
      local allowed=false
      for path in "${STATE_PATHS[@]}"; do
        if [[ "$file" == "$path" ]]; then allowed=true; break; fi
      done
      if [[ "$allowed" != true ]]; then
        echo "::error::non-state path staged for operational state commit: $file"
        exit 1
      fi
    done <<< "$changed"

    git -C "$tmp" commit -m "$message" >/dev/null

    fetch_state_branch
    current="$(git rev-parse "origin/$STATE_BRANCH")"
    if [[ "$current" != "$expected" ]]; then
      echo "::error::ops-state changed before push; refusing non-CAS update"
      exit 1
    fi
    git -C "$tmp" push origin "HEAD:refs/heads/$STATE_BRANCH"
  fi

  fetch_state_branch
  local persisted
  persisted="$(git rev-parse "origin/$STATE_BRANCH")"
  emit_env OPS_STATE_PERSISTED_SHA "$persisted"
  emit_env OPS_STATE_BASE_SHA "$persisted"
  emit_output persisted_sha "$persisted"
  printf 'Operational state authoritative SHA: %s\n' "$persisted"
}

case "${1:-}" in
  overlay) overlay ;;
  persist) shift; persist "$@" ;;
  paths) printf '%s\n' "${STATE_PATHS[@]}" ;;
  *) echo "usage: $0 {overlay|persist [message]|paths}" >&2; exit 2 ;;
esac
