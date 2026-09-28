<p align="center">
  <img src="web/public/logo.svg" alt="Unciv Web Platform logo" width="128" height="128" />
</p>

<h1 align="center">Unciv-Web-Platform</h1>

<p align="center">
  <a href="https://app.codacy.com/gh/Redstoneur/Unciv-Web-Platform/dashboard?utm_source=gh&utm_medium=referral&utm_content=&utm_campaign=Badge_grade"><img src="https://app.codacy.com/project/badge/Grade/43452bd92b5940acb55d9d60aef267a8" alt="Codacy Badge" /></a>
  <a href="api/package.json"><img src="https://img.shields.io/github/package-json/v/Redstoneur/Unciv-Web-Platform?filename=api%2Fpackage.json&label=version" alt="Version" /></a>
  <a href="https://github.com/yairm210/Unciv/releases/latest"><img src="https://img.shields.io/github/v/release/yairm210/Unciv?label=Unciv&logo=github" alt="Latest Unciv release" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/Redstoneur/Unciv-Web-Platform" alt="License" /></a>
  <a href="https://github.com/Redstoneur/Unciv-Web-Platform"><img src="https://img.shields.io/github/repo-size/Redstoneur/Unciv-Web-Platform" alt="Repository size" /></a>
  <a href="https://github.com/Redstoneur/Unciv-Web-Platform"><img src="https://img.shields.io/github/languages/code-size/Redstoneur/Unciv-Web-Platform" alt="Code size" /></a>
  <a href="https://github.com/Redstoneur/Unciv-Web-Platform"><img src="https://img.shields.io/github/languages/top/Redstoneur/Unciv-Web-Platform" alt="Top language" /></a>
  <a href="https://github.com/Redstoneur/Unciv-Web-Platform/commits"><img src="https://img.shields.io/github/last-commit/Redstoneur/Unciv-Web-Platform" alt="Last commit" /></a>
  <a href="https://github.com/Redstoneur/Unciv-Web-Platform/issues"><img src="https://img.shields.io/github/issues/Redstoneur/Unciv-Web-Platform" alt="Issues" /></a>
  <a href="https://github.com/Redstoneur/Unciv-Web-Platform/stargazers"><img src="https://img.shields.io/github/stars/Redstoneur/Unciv-Web-Platform" alt="Stars" /></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-24_LTS-5FA04E?logo=nodedotjs&logoColor=white" alt="Node.js 24 LTS" />
  <img src="https://img.shields.io/badge/TypeScript-6_%7C_7-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Fastify-5-000000?logo=fastify&logoColor=white" alt="Fastify 5" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React 19" />
  <img src="https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white" alt="Vite 8" />
  <img src="https://img.shields.io/badge/PostgreSQL-18-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL 18" />
  <img src="https://img.shields.io/badge/Java-25_LTS-ED8B00?logo=openjdk&logoColor=white" alt="Java 25 LTS" />
  <img src="https://img.shields.io/badge/Traefik-3.7-24A1C1?logo=traefikproxy&logoColor=white" alt="Traefik 3.7" />
  <img src="https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white" alt="Docker Compose" />
</p>

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
single `docker-compose.yaml`.

| Folder         | Role                                                                                     |
|----------------|------------------------------------------------------------------------------------------|
| `api/`         | Node.js + TypeScript + Fastify API: accounts, sessions, updates, admin (PostgreSQL)      |
| `web/`         | Vite + React + TypeScript front end (i18next), served by nginx                           |
| `game/`        | Game image: JRE 25, Xvfb, openbox, x11vnc, noVNC; one container per active player        |
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
