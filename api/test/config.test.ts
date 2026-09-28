import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

const base = {
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  JWT_SECRET: 'x'.repeat(32),
};

describe('loadConfig', () => {
  it('applies defaults and keeps the multiplayer server disabled', () => {
    const config = loadConfig(base);
    expect(config.PORT).toBe(3000);
    expect(config.REGISTRATION_ENABLED).toBe(true);
    expect(config.multiplayerServerPublicUrl).toBeNull();
    expect(config.multiplayerServerGameUrl).toBeNull();
    expect(config.cookieSecure).toBe(false);
  });

  it('derives multiplayer URLs from PUBLIC_URL', () => {
    const config = loadConfig({
      ...base,
      PUBLIC_URL: 'https://unciv.example.com/',
      MULTIPLAYER_SERVER_ENABLED: 'true',
      MULTIPLAYER_SERVER_GAME_URL: 'http://multiplayer:8080',
    });
    expect(config.PUBLIC_URL).toBe('https://unciv.example.com');
    expect(config.cookieSecure).toBe(true);
    expect(config.multiplayerServerPublicUrl).toBe('https://unciv.example.com/multiplayer');
    expect(config.multiplayerServerGameUrl).toBe('http://multiplayer:8080');
  });

  it('normalises admin emails', () => {
    const config = loadConfig({ ...base, ADMIN_EMAILS: ' Admin@Example.com , ,b@c.d' });
    expect([...config.adminEmails]).toEqual(['admin@example.com', 'b@c.d']);
  });

  it('treats empty variables as unset', () => {
    const config = loadConfig({
      ...base,
      MULTIPLAYER_SERVER_ENABLED: 'true',
      MULTIPLAYER_SERVER_PUBLIC_URL: '',
      GITHUB_TOKEN: '',
    });
    expect(config.multiplayerServerPublicUrl).toBe('http://localhost/multiplayer');
    expect(config.GITHUB_TOKEN).toBeUndefined();
  });

  it('rejects a short JWT secret', () => {
    expect(() => loadConfig({ ...base, JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/);
  });
});
