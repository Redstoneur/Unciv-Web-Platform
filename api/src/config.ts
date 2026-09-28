import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  DATABASE_URL: z.url(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
  COOKIE_SECURE: z.stringbool().optional(),
  PUBLIC_URL: z.url().default('http://localhost'),
  ADMIN_EMAILS: z.string().default(''),
  REGISTRATION_ENABLED: z.stringbool().default(true),

  RELEASES_DIR: z.string().default('/releases'),
  RELEASES_VOLUME: z.string().default('unciv-releases'),
  UNCIV_REPOSITORY: z
    .string()
    .regex(/^[\w.-]+\/[\w.-]+$/)
    .default('yairm210/Unciv'),
  GITHUB_TOKEN: z.string().optional(),
  UPDATE_CHECK_INTERVAL_MINUTES: z.coerce.number().int().min(0).default(360),
  AUTO_ACTIVATE_UPDATES: z.stringbool().default(true),

  DOCKER_SOCKET: z.string().default('/var/run/docker.sock'),
  GAME_IMAGE: z.string().default('unciv-web-platform/game:latest'),
  GAME_NETWORK: z.string().default('unciv-edge'),
  GAME_CPU_LIMIT: z.coerce.number().positive().default(1),
  GAME_MEMORY_MB: z.coerce.number().int().min(512).default(1536),
  GAME_SCREEN_WIDTH: z.coerce.number().int().min(800).default(1600),
  GAME_SCREEN_HEIGHT: z.coerce.number().int().min(600).default(900),
  USER_VOLUME_PREFIX: z.string().default('unciv-user-'),
  MAX_ACTIVE_SESSIONS: z.coerce.number().int().positive().default(10),
  SESSION_IDLE_TIMEOUT_MINUTES: z.coerce.number().int().positive().default(15),
  SESSION_MAX_DURATION_HOURS: z.coerce.number().int().positive().default(8),

  MULTIPLAYER_SERVER_ENABLED: z.stringbool().default(false),
  MULTIPLAYER_SERVER_PUBLIC_URL: z.url().optional(),
  MULTIPLAYER_SERVER_GAME_URL: z.url().optional(),
});

export type Env = z.infer<typeof envSchema>;

export interface Config extends Env {
  isProduction: boolean;
  cookieSecure: boolean;
  adminEmails: Set<string>;
  /** URL of the optional platform multiplayer server, as seen by players (null when disabled). */
  multiplayerServerPublicUrl: string | null;
  /** URL of the optional platform multiplayer server, as seen from inside game containers. */
  multiplayerServerGameUrl: string | null;
}

const stripTrailingSlashes = (url: string): string => url.replace(/\/+$/, '');

export function loadConfig(source: NodeJS.ProcessEnv = process.env): Config {
  // Compose passes unset variables as empty strings: treat them as absent.
  const defined = Object.fromEntries(Object.entries(source).filter(([, value]) => value !== ''));
  const parsed = envSchema.safeParse(defined);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(parsed.error)}`);
  }
  const env = parsed.data;
  const publicUrl = stripTrailingSlashes(env.PUBLIC_URL);
  const multiplayerServerPublicUrl = env.MULTIPLAYER_SERVER_ENABLED
    ? stripTrailingSlashes(env.MULTIPLAYER_SERVER_PUBLIC_URL ?? `${publicUrl}/multiplayer`)
    : null;

  return {
    ...env,
    PUBLIC_URL: publicUrl,
    isProduction: env.NODE_ENV === 'production',
    cookieSecure: env.COOKIE_SECURE ?? publicUrl.startsWith('https://'),
    adminEmails: new Set(
      env.ADMIN_EMAILS.split(',')
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
    multiplayerServerPublicUrl,
    multiplayerServerGameUrl: multiplayerServerPublicUrl
      ? stripTrailingSlashes(env.MULTIPLAYER_SERVER_GAME_URL ?? multiplayerServerPublicUrl)
      : null,
  };
}
