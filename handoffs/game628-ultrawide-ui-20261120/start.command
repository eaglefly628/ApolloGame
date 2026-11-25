#!/bin/zsh
set -eu
cd -- "${0:A:h}"
url=http://127.0.0.1:18844/
vite=../../node_modules/.bin/vite
prototype=${GAME628_PROTOTYPE_DIST:-../game628-life-controls-20261117/dist}
[[ -r "$prototype/index.html" ]] || { print -u2 "缺少试玩构建：$prototype/index.html"; exit 1; }
[[ -r dist/index.html ]] || "$vite" build --config vite.config.mjs
if [[ "${1:-}" != --no-browser ]]; then
  (
    for attempt in {1..40}; do
      if html="$(/usr/bin/curl --noproxy '*' -fsS --max-time 1 "$url" 2>/dev/null)" &&
         [[ "$html" == *'game628-ultrawide-ui'* ]]; then
        /usr/bin/open "$url"
        exit
      fi
      sleep 0.2
    done
  ) &
fi
print "Game 628 超宽 UI：$url"
exec "$vite" preview --config vite.config.mjs
