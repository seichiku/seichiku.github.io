#!/usr/bin/env bash
# update-pamphlet.sh
# 採用パンフレットのラフ案 index.html を pamphlet-draft/ に差し替え、
# commit & push して GitHub Pages を更新するスクリプト。
#
# 使い方:
#   ./update-pamphlet.sh <新しい index.html のパス>
#   例) ./update-pamphlet.sh ~/Downloads/index.html

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET_DIR="$REPO_DIR/pamphlet-draft"
TARGET_FILE="$TARGET_DIR/index.html"

if [ $# -lt 1 ]; then
  echo "Usage: $0 <path-to-new-index.html>"
  exit 1
fi

SRC="$1"

if [ ! -f "$SRC" ]; then
  echo "Error: source file not found: $SRC"
  exit 1
fi

cd "$REPO_DIR"

echo "==> git pull --rebase"
git pull --rebase

mkdir -p "$TARGET_DIR"

echo "==> copy: $SRC -> $TARGET_FILE"
cp "$SRC" "$TARGET_FILE"

if git diff --quiet -- "$TARGET_FILE" && ! git status --porcelain "$TARGET_FILE" | grep -q .; then
  echo "No changes detected. Nothing to commit."
  exit 0
fi

git add "$TARGET_FILE"

DEFAULT_MSG="Update: 採用パンフレットラフ案ビジュアル ($(date '+%Y-%m-%d %H:%M'))"
MSG="${COMMIT_MSG:-$DEFAULT_MSG}"

echo "==> commit: $MSG"
git commit -m "$MSG"

echo "==> push"
git push

echo ""
echo "Done."
echo "公開URL: https://seichiku.github.io/pamphlet-draft/"
echo "（反映までに1〜2分かかる場合があります）"
