FROM traefik:v3.7

COPY traefik.yml /etc/traefik/traefik.yml
COPY dynamic /etc/traefik/dynamic

HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD ["traefik", "healthcheck", "--ping"]
