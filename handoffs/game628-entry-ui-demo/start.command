#!/bin/zsh
set -eu
cd -- "${0:A:h}/../.."
demo=handoffs/game628-entry-ui-demo
url=http://127.0.0.1:18841/
ready() {
  local html
  html="$(/usr/bin/curl --noproxy '*' -fsS --max-time 1 "$url" 2>/dev/null)" &&
    [[ "$html" == *'<title>小生活 · 梧桐街</title>'* ]]
}

if ready; then
  print "Game 628 已运行：$url"
  [[ "${1:-}" == --no-browser ]] || /usr/bin/open "$url"
  exit 0
fi

if [[ ! -r handoffs/game628-life-controls-20261117/dist/index.html ]]; then
  print -u2 '缺少梧桐街试玩构建，请先构建 game628-life-controls-20261117。'
  exit 1
fi

if [[ ! -r "$demo/dist/index.html" ]]; then
  ./node_modules/.bin/vite build --config "$demo/vite.config.mjs"
fi
if [[ "${1:-}" != --no-browser ]]; then
  (
    for attempt in {1..25}; do
      if ready; then /usr/bin/open "$url"; exit; fi
      sleep 0.2
    done
  ) &
fi

print "正在启动 Game 628：$url（试玩期间请保留此终端窗口）"
exec ./node_modules/.bin/vite preview --config "$demo/vite.config.mjs"
