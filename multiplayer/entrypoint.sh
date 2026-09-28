#!/bin/sh
# Waits for the platform to publish a version, then runs its UncivServer.jar.
set -eu

CURRENT_FILE=/releases/current

until [ -s "$CURRENT_FILE" ]; do
  echo "Waiting for the platform to download an Unciv release…"
  sleep 10
done

VERSION=$(tr -d '[:space:]' < "$CURRENT_FILE")
JAR="/releases/${VERSION}/UncivServer.jar"
if [ ! -f "$JAR" ]; then
  echo "UncivServer.jar not found for version ${VERSION}: $JAR" >&2
  exit 1
fi

AUTH_FLAG="-auth"
[ "$UNCIV_SERVER_AUTH" = "true" ] || AUTH_FLAG="-no-auth"

echo "Starting UncivServer ${VERSION} on port ${UNCIV_SERVER_PORT}"
# shellcheck disable=SC2086
exec java $JAVA_OPTS -jar "$JAR" -port "$UNCIV_SERVER_PORT" -folder /data/MultiplayerFiles "$AUTH_FLAG"
