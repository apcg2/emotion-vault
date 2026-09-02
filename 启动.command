#!/bin/bash

# Keep this file in the project root. Paths may contain spaces or Chinese text.
EMOTION_ROOT="$(cd -- "$(dirname -- "$0")" && pwd -P)" || exit 1
cd "$EMOTION_ROOT" || exit 1

EMOTION_NODE="$(command -v node || true)"
if [ -z "$EMOTION_NODE" ]; then
  for EMOTION_CANDIDATE in /opt/homebrew/bin/node /usr/local/bin/node "$HOME/.volta/bin/node" "$HOME/.nvm/versions/node/v24.16.0/bin/node"; do
    if [ -x "$EMOTION_CANDIDATE" ]; then
      EMOTION_NODE="$EMOTION_CANDIDATE"
      break
    fi
  done
fi

if [ -z "$EMOTION_NODE" ]; then
  echo "未找到 Node.js。请先安装 Node.js 24，再按 README 完成首次安装和构建。"
  echo "此启动文件不会自动安装软件，也不会修改系统权限。"
  if [ -t 0 ]; then read -r -p "按回车关闭…"; fi
  exit 1
fi

"$EMOTION_NODE" "$EMOTION_ROOT/scripts/launch.mjs" "$@"
EMOTION_EXIT=$?
if [ "$EMOTION_EXIT" -ne 0 ] && [ -t 0 ]; then read -r -p "按回车关闭…"; fi
exit "$EMOTION_EXIT"
