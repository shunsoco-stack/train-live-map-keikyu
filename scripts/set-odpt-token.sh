#!/usr/bin/env bash
# ODPT Challenge 2026トークンを、表示せずに .env.local へ保存する。
# 引数では受け取らないため、shell historyやprocess listへ秘密値を残さない。

set -euo pipefail
umask 077

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root_dir="$(dirname "$script_dir")"
env_file="$root_dir/.env.local"
temporary_file=""

cleanup() {
  if [[ -n "$temporary_file" && -f "$temporary_file" ]]; then
    rm -f -- "$temporary_file"
  fi
}
trap cleanup EXIT

printf 'ODPT Challenge 2026 アクセストークン: '
IFS= read -r -s token
printf '\n'

token="$(printf '%s' "$token" | tr -d '[:space:]')"
if [[ -z "$token" ]]; then
  printf 'トークンが入力されていません。\n' >&2
  exit 1
fi

temporary_file="$(mktemp "$root_dir/.env.local.XXXXXX")"
if [[ -f "$env_file" ]]; then
  awk '
    !/^ODPT_ACCESS_TOKEN=/ &&
    !/^ODPT_API_BASE_URL=/
  ' "$env_file" > "$temporary_file"
fi

{
  printf 'ODPT_ACCESS_TOKEN=%s\n' "$token"
  printf 'ODPT_API_BASE_URL=https://api-challenge.odpt.org/api/v4\n'
} >> "$temporary_file"

mv -f -- "$temporary_file" "$env_file"
temporary_file=""
chmod 600 "$env_file"
unset token

printf '.env.local へ保存しました。値は表示していません。\n'
printf '次に /dev/debug で京急のoperator・路線・列車情報を確認してください。\n'
