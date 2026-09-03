#!/bin/zsh
cd -- "$(dirname -- "$0")" || exit 1
if [ -f .local/node-path.txt ]; then
  IFS= read -r emotion_node < .local/node-path.txt
  if [ -z "$emotion_node" ] || [ ! -x "$emotion_node" ]; then
    echo "项目 Node 路径失效，请用 Node 24 运行 scripts/configure-runtime.mjs --replace。"
    read -r "?按回车关闭…"
    exit 1
  fi
  "$emotion_node" scripts/launch.mjs "$@"
  result=$?
  if [ "$result" -ne 0 ]; then
    read -r "?启动失败。请保留上方错误信息，按回车关闭…"
  fi
  exit "$result"
fi
if ! command -v node >/dev/null 2>&1; then
  export PATH="$PATH:/opt/homebrew/bin:/usr/local/bin"
fi
if ! command -v node >/dev/null 2>&1; then
  echo "未找到 Node.js。请按 README 安装 Node.js 24，并完成首次构建。"
  read -r "?按回车关闭…"
  exit 1
fi
node scripts/launch.mjs "$@"
result=$?
if [ "$result" -ne 0 ]; then
  read -r "?启动失败。请保留上方错误信息，按回车关闭…"
fi
exit "$result"
