# Unciv-Web-Platform

Web platform to play the original [Unciv](https://github.com/yairm210/Unciv) desktop game in the browser, with user
accounts, automatic game updates and an optional multiplayer server.

> **Disclaimer:** Unciv Web Platform is an **unofficial** community project. It is not affiliated with,
> endorsed by, or maintained by the Unciv developers.

## Principles

- **Original game, unmodified**: the official `Unciv.jar` is downloaded from the GitHub releases (SHA-256 verified)
  and streamed to the browser (Xvfb + noVNC). Nothing is patched.
- **Always up to date**: new releases are detected, downloaded and activated automatically (or manually by an admin).
  Running sessions keep their version until they end.
- **No lock-in**: players can keep using the standalone game. Their account exposes the Unciv user ID and the
  multiplayer server URL to configure in the desktop/mobile game, so the same multiplayer games are reachable
  from both.
- **Multiplayer**: Unciv's official server is used by default. The platform can optionally host the official
  `UncivServer.jar`, and each player can choose official / platform / custom server.
- **Multi-language**: French by default, English available (see `web/src/i18n.ts` to add a language).

## Architecture

Monorepo, one folder per component, each with its own `package.json` (npm) and `Dockerfile`, orchestrated by a
single `compose.yaml`.

| Folder         | Role                                                                                     |
|----------------|------------------------------------------------------------------------------------------|
| `api/`         | Node.js + TypeScript + Fastify API: accounts, sessions, updates, admin (PostgreSQL)      |
| `web/`         | Vite + React + TypeScript front end (i18next), served by nginx                           |
| `game/`        | Game image: JRE 21, Xvfb, openbox, x11vnc, noVNC; one container per active player        |
| `multiplayer/` | Optional official `UncivServer.jar` (compose profile `multiplayer`)                      |
| `proxy/`       | Traefik: routes `/`, `/api`, `/multiplayer` and `/play/<session>` (forward auth)         |

```
browser ──► proxy ──┬─► web             (SPA)
                    ├─► api ──► db       (PostgreSQL)
                    │    └──► docker-proxy ──► game containers (created on demand)
                    ├─► /play/<id>  ──► game container (noVNC, owner only)
                    └─► /multiplayer ─► multiplayer (optional)
```

- Game jars are stored in the `unciv-releases` volume and mounted read-only in game containers.
- Each player has a persistent `unciv-user-<id>` volume (saves, settings, mods).
- The API talks to Docker only through a restricted socket proxy.

## Quick start

Requirements: Docker with Compose v2.

```sh
cp .env.example .env        # then set JWT_SECRET, POSTGRES_PASSWORD, ADMIN_EMAILS, PUBLIC_URL
docker compose up -d --build
# with the optional multiplayer server:
docker compose --profile multiplayer up -d --build
```

Open `PUBLIC_URL`, create an account (emails listed in `ADMIN_EMAILS` get the admin role). The latest Unciv
release is downloaded on first start; the admin page shows versions and allows manual install/activation.

For production, put the platform behind HTTPS (`PUBLIC_URL=https://...` enables secure cookies).

## Development

Each app is an independent npm project:

```sh
cd api
npm install
npm run dev        # also: npm run typecheck | lint | test | build | db:generate

cd web
npm install
npm run dev        # proxies /api to localhost:3000; also: npm run lint | build
```

The API needs PostgreSQL and Docker (see `api/src/config.ts` for the environment variables).

## Playing without the platform

On the **dashboard**, the platform shows your Unciv user ID and the multiplayer server in use. Enter them in the
standalone game (Options → Multiplayer) to access the same multiplayer games. In **Settings** you can also paste
the user ID of an existing standalone installation and choose the multiplayer server.

## Known limitations

- No sound in the browser.
- No email verification or password reset yet.

## License

This project is licensed under the Mozilla Public License 2.0 (MPL-2.0).

Unciv Web Platform is an independent project built around the official Unciv game (https://github.com/yairm210/Unciv),
which is also licensed under MPL-2.0. The game is downloaded from the official releases and redistributed unmodified.
