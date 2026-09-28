# syntax=docker/dockerfile:1
#
# Runs the official, unmodified Unciv desktop jar inside a virtual X display and
# streams it to the browser with noVNC. The jar itself is NOT baked into the image:
# it is mounted read-only from the releases volume (/releases/<version>/Unciv.jar),
# so new Unciv versions never require rebuilding this image.

FROM eclipse-temurin:21-jre-noble

ARG DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    xvfb x11vnc openbox novnc python3-websockify \
    libgl1 libgl1-mesa-dri libglu1-mesa \
    libxcursor1 libxrandr2 libxi6 libxxf86vm1 libxinerama1 libxtst6 \
    fonts-dejavu-core fonts-noto-core \
    jq curl procps tini xdotool \
  && rm -rf /var/lib/apt/lists/*

# The game runs as an unprivileged user; /data is the per-user persistent volume
# (saves, mods, GameSettings.json). Its ownership is copied to fresh named volumes.
RUN useradd --create-home --uid 10001 --shell /usr/sbin/nologin unciv \
  && mkdir -p /data \
  && chown unciv:unciv /data

COPY --chmod=0755 entrypoint.sh /usr/local/bin/entrypoint.sh
COPY --chmod=0755 healthcheck.sh /usr/local/bin/healthcheck.sh
COPY index.html /usr/share/novnc/index.html

ENV DISPLAY=:0 \
    SCREEN_WIDTH=1600 \
    SCREEN_HEIGHT=900 \
    UNCIV_LANGUAGE=French \
    UNCIV_MULTIPLAYER_SERVER=https://uncivserver.xyz \
    JAVA_OPTS="-XX:MaxRAMPercentage=75" \
    LIBGL_ALWAYS_SOFTWARE=1 \
    ALSOFT_DRIVERS=null

USER unciv
WORKDIR /data
EXPOSE 6080
HEALTHCHECK --interval=5s --timeout=3s --start-period=10s --retries=3 CMD ["/usr/local/bin/healthcheck.sh"]
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/entrypoint.sh"]
