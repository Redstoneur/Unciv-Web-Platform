# syntax=docker/dockerfile:1
#
# Optional multiplayer server: runs the official UncivServer.jar of the version
# currently activated by the platform (read from /releases/current).
# Players can keep using the official public server or any other server instead.

FROM eclipse-temurin:21-jre-noble

RUN apt-get update \
  && apt-get install -y --no-install-recommends curl tini \
  && rm -rf /var/lib/apt/lists/* \
  && useradd --create-home --uid 10001 --shell /usr/sbin/nologin unciv \
  && mkdir -p /data \
  && chown unciv:unciv /data

COPY --chmod=0755 entrypoint.sh /usr/local/bin/entrypoint.sh

ENV UNCIV_SERVER_PORT=8080 \
    UNCIV_SERVER_AUTH=true \
    JAVA_OPTS="-XX:MaxRAMPercentage=75"

USER unciv
WORKDIR /data
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -fsS -o /dev/null "http://127.0.0.1:${UNCIV_SERVER_PORT}/isalive" || exit 1
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/entrypoint.sh"]
