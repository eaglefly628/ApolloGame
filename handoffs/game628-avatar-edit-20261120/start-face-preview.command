#!/bin/bash
set -eu
cd -- "$(dirname -- "$0")"
url='http://127.0.0.1:18851'
if curl --fail --silent --output /dev/null "$url/scenes/avatar-studio.json"; then
  open "$url/?scene=avatar-studio"
  exit
fi

../../node_modules/.bin/vite build
python3 -m http.server 18851 --bind 127.0.0.1 --directory dist &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null || true' EXIT
for attempt in {1..30}; do
  if curl --fail --silent --output /dev/null "$url/scenes/avatar-studio.json"; then
    open "$url/?scene=avatar-studio"
    wait "$server_pid"
    exit
  fi
  sleep 0.1
done
echo '捏脸预览未能启动。' >&2
exit 1
