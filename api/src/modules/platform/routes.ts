import type { FastifyInstance } from 'fastify';
import { OFFICIAL_MULTIPLAYER_SERVER } from '../../lib/multiplayer.js';
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from '../../lib/locales.js';
import { downloadLinks } from '../versions/releases.js';

/** Public information used by the landing page (no authentication). */
export async function platformRoutes(app: FastifyInstance): Promise<void> {
  const { config, versions } = app.services;

  app.get('/health', { config: { public: true, rateLimit: false } }, async () => ({
    status: 'ok',
  }));

  app.get('/platform', { config: { public: true } }, async () => {
    const current = await versions.getCurrent();
    return {
      registrationEnabled: config.REGISTRATION_ENABLED,
      currentVersion: current?.tag ?? null,
      releaseUrl: current?.releaseUrl ?? null,
      locales: SUPPORTED_LOCALES,
      defaultLocale: DEFAULT_LOCALE,
      multiplayer: {
        officialServerUrl: OFFICIAL_MULTIPLAYER_SERVER,
        platformServerUrl: config.multiplayerServerPublicUrl,
      },
      downloads: downloadLinks(config.UNCIV_REPOSITORY, current?.tag ?? null),
      sourceCode: `https://github.com/${config.UNCIV_REPOSITORY}`,
    };
  });
}
