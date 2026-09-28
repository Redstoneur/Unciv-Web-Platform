import type { Config } from './config.js';
import type { Database } from './db/client.js';
import type { User } from './db/schema.js';
import type { DockerService } from './modules/sessions/docker.js';
import type { SessionService } from './modules/sessions/service.js';
import type { VersionService } from './modules/versions/service.js';

export interface Services {
  config: Config;
  db: Database;
  docker: DockerService;
  versions: VersionService;
  sessions: SessionService;
}

declare module 'fastify' {
  interface FastifyInstance {
    services: Services;
  }

  interface FastifyRequest {
    currentUser: User | null;
  }

  interface FastifyContextConfig {
    /** Skip the authentication check (public route). */
    public?: boolean;
    /** Require the admin role. */
    admin?: boolean;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string };
    user: { sub: string };
  }
}
