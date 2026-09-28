#!/bin/sh
# Healthy once the Unciv window is displayed and the noVNC endpoint answers.
xdotool search --name '^Unciv$' >/dev/null 2>&1 || exit 1
curl -fsS -o /dev/null http://127.0.0.1:6080/vnc.html || exit 1
