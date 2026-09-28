import pino from 'pino';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { createDatabase, runMigrations } from './db/client.js';
import { DockerService, MULTIPLAYER_ROLE } from './modules/sessions/docker.js';
import { SessionService } from './modules/sessions/service.js';
import { VersionService } from './modules/versions/service.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const logger = pino({ level: config.LOG_LEVEL });

  const database = createDatabase(config.DATABASE_URL);
  await runMigrations(database.db);

  const docker = new DockerService(config);
  const versions = new VersionService({
    config,
    db: database.db,
    logger,
    onActivated: async () => {
      const restarted = await docker.restartByRole(MULTIPLAYER_ROLE);
      if (restarted > 0) logger.info({ restarted }, 'Multiplayer server restarted on new version');
    },
  });
  const sessions = new SessionService({ config, db: database.db, docker, versions, logger });

  const app = await buildApp(
    { config, db: database.db, docker, versions, sessions },
    { loggerInstance: logger },
  );

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    versions.stopScheduler();
    sessions.stopScheduler();
    await app.close();
    await database.close();
    process.exit(0);
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({ host: config.HOST, port: config.PORT });
  versions.startScheduler();
  sessions.startScheduler();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
