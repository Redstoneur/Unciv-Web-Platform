import { describe, expect, it } from 'vitest';
import { toUncivLanguage } from '../src/lib/locales.js';
import {
  OFFICIAL_MULTIPLAYER_SERVER,
  resolveGameMultiplayerServer,
  resolvePublicMultiplayerServer,
} from '../src/lib/multiplayer.js';
import { traefikLabels } from '../src/modules/sessions/docker.js';
import { buildPlayUrl, sessionIdFromPath } from '../src/modules/sessions/service.js';

const enabled = {
  multiplayerServerPublicUrl: 'https://play.example.com/multiplayer',
  multiplayerServerGameUrl: 'http://multiplayer:8080',
};
const disabled = { multiplayerServerPublicUrl: null, multiplayerServerGameUrl: null };

describe('multiplayer server resolution', () => {
  it('uses the official server by default', () => {
    const user = { multiplayerMode: 'official' as const, customMultiplayerUrl: null };
    expect(resolveGameMultiplayerServer(user, enabled)).toBe(OFFICIAL_MULTIPLAYER_SERVER);
    expect(resolvePublicMultiplayerServer(user, enabled)).toBe(OFFICIAL_MULTIPLAYER_SERVER);
  });

  it('uses the platform server with internal and public URLs', () => {
    const user = { multiplayerMode: 'platform' as const, customMultiplayerUrl: null };
    expect(resolveGameMultiplayerServer(user, enabled)).toBe('http://multiplayer:8080');
    expect(resolvePublicMultiplayerServer(user, enabled)).toBe(enabled.multiplayerServerPublicUrl);
    expect(resolveGameMultiplayerServer(user, disabled)).toBe(OFFICIAL_MULTIPLAYER_SERVER);
  });

  it('uses a custom server', () => {
    const user = { multiplayerMode: 'custom' as const, customMultiplayerUrl: 'https://my.server' };
    expect(resolveGameMultiplayerServer(user, disabled)).toBe('https://my.server');
  });
});

describe('locales', () => {
  it('maps platform locales to Unciv languages', () => {
    expect(toUncivLanguage('fr')).toBe('French');
    expect(toUncivLanguage('en')).toBe('English');
    expect(toUncivLanguage('xx')).toBe('French');
  });
});

describe('game sessions routing', () => {
  const id = '0f8fad5b-d9cb-469f-a165-70867728950e';

  it('extracts the session id from proxied paths', () => {
    expect(sessionIdFromPath(`/play/${id}/vnc.html`)).toBe(id);
    expect(sessionIdFromPath(`/play/${id}/websockify`)).toBe(id);
    expect(sessionIdFromPath(`/play/${id.toUpperCase()}`)).toBe(id);
    expect(sessionIdFromPath('/play/not-a-session/x')).toBeNull();
    expect(sessionIdFromPath('/api/sessions')).toBeNull();
  });

  it('builds the noVNC URL', () => {
    const url = new URL(buildPlayUrl({ id, vncPassword: 'secret' }), 'http://localhost');
    expect(url.pathname).toBe(`/play/${id}/vnc.html`);
    expect(url.searchParams.get('path')).toBe(`play/${id}/websockify`);
    expect(url.searchParams.get('password')).toBe('secret');
  });

  it('declares Traefik labels protected by forward auth', () => {
    const labels = traefikLabels(id, 'unciv-games');
    const router = `traefik.http.routers.unciv-game-${id}`;
    expect(labels[`${router}.rule`]).toBe(`PathPrefix(\`/play/${id}/\`)`);
    expect(labels[`${router}.middlewares`]).toContain('game-auth@file');
    expect(labels['traefik.docker.network']).toBe('unciv-games');
  });
});
