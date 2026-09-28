#!/bin/sh
# Starts a virtual display, the official Unciv jar and a noVNC endpoint on port 6080.
set -eu

: "${UNCIV_VERSION:?UNCIV_VERSION is required}"
: "${VNC_PASSWORD:?VNC_PASSWORD is required}"

JAR="/releases/${UNCIV_VERSION}/Unciv.jar"
SETTINGS="/data/GameSettings.json"

if [ ! -f "$JAR" ]; then
  echo "Unciv jar not found: $JAR" >&2
  exit 1
fi

# Merge the platform managed settings into the player's GameSettings.json, keeping
# everything else the player configured in game. Unciv writes standard JSON.
current='{}'
if [ -s "$SETTINGS" ] && jq -e 'type == "object"' "$SETTINGS" >/dev/null 2>&1; then
  current=$(cat "$SETTINGS")
fi
printf '%s' "$current" | jq \
  --arg userId "${UNCIV_USER_ID:-}" \
  --arg server "$UNCIV_MULTIPLAYER_SERVER" \
  --arg language "$UNCIV_LANGUAGE" \
  --argjson width "$SCREEN_WIDTH" \
  --argjson height "$SCREEN_HEIGHT" \
  '
    .language = $language
    | .screenMode = 2
    | .windowState = { width: $width, height: $height }
    | .isFreshlyCreated = false
    | .multiplayer = ((.multiplayer // {}) + { server: $server })
    | if $userId != "" then .multiplayer.userId = $userId else . end
  ' > "${SETTINGS}.tmp"
mv "${SETTINGS}.tmp" "$SETTINGS"

VNC_PASSWD_FILE=/tmp/vncpasswd
x11vnc -storepasswd "$VNC_PASSWORD" "$VNC_PASSWD_FILE" >/dev/null 2>&1

Xvfb "$DISPLAY" -screen 0 "${SCREEN_WIDTH}x${SCREEN_HEIGHT}x24" -nolisten tcp -ac &
for _ in $(seq 1 50); do
  [ -e "/tmp/.X11-unix/X${DISPLAY#:}" ] && break
  sleep 0.1
done

openbox >/dev/null 2>&1 &

x11vnc -display "$DISPLAY" -rfbauth "$VNC_PASSWD_FILE" -localhost -rfbport 5900 \
  -forever -shared -noxdamage -quiet >/dev/null 2>&1 &

websockify --web /usr/share/novnc 6080 localhost:5900 >/dev/null 2>&1 &

cd /data
# shellcheck disable=SC2086
java $JAVA_OPTS -jar "$JAR" --data-dir=/data &
GAME_PID=$!

# The container lives as long as the game: quitting Unciv ends the session.
wait "$GAME_PID"
