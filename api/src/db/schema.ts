import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const userRole = pgEnum('user_role', ['user', 'admin']);
export const multiplayerMode = pgEnum('multiplayer_mode', ['official', 'platform', 'custom']);
export const versionStatus = pgEnum('version_status', ['downloading', 'ready', 'failed']);
export const sessionStatus = pgEnum('session_status', ['starting', 'running', 'stopped', 'failed']);

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    username: text('username').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: userRole('role').notNull().default('user'),
    locale: text('locale').notNull().default('fr'),
    /** Unciv multiplayer player ID, reusable in the standalone game. */
    uncivUserId: uuid('unciv_user_id').notNull().defaultRandom(),
    multiplayerMode: multiplayerMode('multiplayer_mode').notNull().default('official'),
    customMultiplayerUrl: text('custom_multiplayer_url'),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('users_email_unique').on(sql`lower(${table.email})`),
    uniqueIndex('users_username_unique').on(sql`lower(${table.username})`),
  ],
);

export const gameVersions = pgTable(
  'game_versions',
  {
    tag: text('tag').primaryKey(),
    releaseUrl: text('release_url').notNull(),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    gameJarSha256: text('game_jar_sha256'),
    serverJarSha256: text('server_jar_sha256'),
    status: versionStatus('status').notNull().default('downloading'),
    error: text('error'),
    isCurrent: boolean('is_current').notNull().default(false),
    downloadedAt: timestamp('downloaded_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('game_versions_single_current')
      .on(table.isCurrent)
      .where(sql`${table.isCurrent} = true`),
  ],
);

export const gameSessions = pgTable(
  'game_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    version: text('version')
      .notNull()
      .references(() => gameVersions.tag),
    containerId: text('container_id'),
    status: sessionStatus('status').notNull().default('starting'),
    vncPassword: text('vnc_password').notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    stoppedAt: timestamp('stopped_at', { withTimezone: true }),
    stopReason: text('stop_reason'),
    ...timestamps,
  },
  (table) => [
    index('game_sessions_status_idx').on(table.status),
    uniqueIndex('game_sessions_one_active_per_user')
      .on(table.userId)
      .where(sql`${table.status} in ('starting', 'running')`),
  ],
);

export type User = typeof users.$inferSelect;
export type GameVersion = typeof gameVersions.$inferSelect;
export type GameSession = typeof gameSessions.$inferSelect;
