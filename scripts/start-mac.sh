#!/usr/bin/env bash
# Train Live Map 京急線版（非公式）macOS用セットアップ。
# 既存のtrain-live-mapとは別ディレクトリ・別リポジトリを使用する。

set -euo pipefail

repo_url="${TRAIN_LIVE_MAP_KEIKYU_REPO:-https://github.com/shunsoco-stack/train-live-map-keikyu.git}"
branch="${TRAIN_LIVE_MAP_KEIKYU_BRANCH:-main}"
target_dir="${TRAIN_LIVE_MAP_KEIKYU_DIR:-$HOME/train-live-map-keikyu}"
port="${PORT:-3000}"
url="http://localhost:${port}"

if ! command -v git >/dev/null 2>&1; then
  printf 'gitが必要です。xcode-select --install を実行してください。\n' >&2
  exit 1
fi
if ! command -v node >/dev/null 2>&1; then
  printf 'Node.js 20以上をインストールしてください。\n' >&2
  exit 1
fi

node_major="$(node -p 'Number(process.versions.node.split(\".\")[0])')"
if (( node_major < 20 )); then
  printf 'Node.js 20以上が必要です（現在: %s）。\n' "$(node -v)" >&2
  exit 1
fi

if [[ -d "$target_dir/.git" ]]; then
  printf '既存の京急版リポジトリを使用します: %s\n' "$target_dir"
elif [[ -e "$target_dir" ]]; then
  printf '対象がGitリポジトリではありません: %s\n' "$target_dir" >&2
  exit 1
else
  git clone --branch "$branch" --single-branch "$repo_url" "$target_dir"
fi

cd "$target_dir"
npm install
printf '起動先: %s\n' "$url"
printf '秘密値は .env.local に設定し、Gitへ追加しないでください。\n'
PORT="$port" npm run dev
