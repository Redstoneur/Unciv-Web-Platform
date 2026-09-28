import { randomBytes } from 'node:crypto';
import { and, count, eq, inArray, lt, or } from 'drizzle-orm';
import type { FastifyBaseLogger } from 'fastify';
import type { Config } from '../../config.js';
import type { Database } from '../../db/client.js';
import { gameSessions, users, type GameSession, type User } from '../../db/schema.js';
import { uniqueViolation } from '../../lib/db-errors.js';
import { AppError } from '../../lib/errors.js';
import { toUncivLanguage } from '../../lib/locales.js';
import { resolveGameMultiplayerServer } from '../../lib/multiplayer.js';
import type { VersionService } from '../versions/service.js';
import type { DockerService } from './docker.js';

const ACTIVE_STATUSES = ['starting', 'running'] as const;
/** A container that is not healthy after this delay is considered failed. */
const START_TIMEOUT_MS = 3 * 60_000;
const RECONCILE_INTERVAL_MS = 30_000;

export interface SessionDto {
  id: string;
  status: GameSession['status'];
  version: string;
  /** Relative URL of the noVNC client, only provided once the session is running. */
  playUrl: string | null;
  createdAt: string;
  lastSeenAt: string;
  stopReason: string | null;
}

export function buildPlayUrl(session: Pick<GameSession, 'id' | 'vncPassword'>): string {
  const base = `/play/${session.id}`;
  const params = new URLSearchParams({
    autoconnect: '1',
    resize: 'scale',
    reconnect: '1',
    path: `play/${session.id}/websockify`,
    password: session.vncPassword,
  });
  return `${base}/vnc.html?${params.toString()}`;
}

export function toSessionDto(session: GameSession): SessionDto {
  return {
    id: session.id,
    status: session.status,
    version: session.version,
    playUrl: session.status === 'running' ? buildPlayUrl(session) : null,
    createdAt: session.createdAt.toISOString(),
    lastSeenAt: session.lastSeenAt.toISOString(),
    stopReason: session.stopReason,
  };
}

/** Extracts the session id from a `/play/<uuid>/…` path. */
export function sessionIdFromPath(path: string): string | null {
  const match = /^\/play\/([0-9a-f-]{36})(?:\/|$)/i.exec(path);
  return match?.[1]?.toLowerCase() ?? null;
}

export interface SessionServiceOptions {
  config: Config;
  db: Database;
  docker: DockerService;
  versions: VersionService;
  logger: FastifyBaseLogger;
}

/** Lifecycle of the per-user game containers. */
export class SessionService {
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly options: SessionServiceOptions) {}

  private get db(): Database {
    return this.options.db;
  }

  async getActive(userId: string): Promise<GameSession | null> {
    const session = await this.db.query.gameSessions.findFirst({
      where: and(eq(gameSessions.userId, userId), inArray(gameSessions.status, ACTIVE_STATUSES)),
    });
    return session ? this.refresh(session) : null;
  }

  listActive() {
    return this.db
      .select({
        id: gameSessions.id,
        status: gameSessions.status,
        version: gameSessions.version,
        createdAt: gameSessions.createdAt,
        lastSeenAt: gameSessions.lastSeenAt,
        userId: users.id,
        username: users.username,
      })
      .from(gameSessions)
      .innerJoin(users, eq(users.id, gameSessions.userId))
      .where(inArray(gameSessions.status, ACTIVE_STATUSES))
      .orderBy(gameSessions.createdAt);
  }

  async start(user: User): Promise<GameSession> {
    const { config, docker, versions } = this.options;
    if (await this.getActive(user.id)) throw new AppError(409, 'SESSION_ALREADY_ACTIVE');

    const [active] = await this.db
      .select({ value: count() })
      .from(gameSessions)
      .where(inArray(gameSessions.status, ACTIVE_STATUSES));
    if ((active?.value ?? 0) >= config.MAX_ACTIVE_SESSIONS) {
      throw new AppError(503, 'SESSION_CAPACITY_REACHED');
    }

    const version = await versions.getCurrent();
    if (!version) throw new AppError(503, 'VERSION_NOT_AVAILABLE');

    let session: GameSession | undefined;
    try {
      [session] = await this.db
        .insert(gameSessions)
        .values({
          userId: user.id,
          version: version.tag,
          // VNC authentication only uses the first 8 characters of the password.
          vncPassword: randomBytes(6).toString('base64url'),
        })
        .returning();
    } catch (error) {
      if (uniqueViolation(error) === 'game_sessions_one_active_per_user') {
        throw new AppError(409, 'SESSION_ALREADY_ACTIVE');
      }
      throw error;
    }
    if (!session) throw new AppError(500, 'INTERNAL_ERROR');

    try {
      const containerId = await docker.startGameContainer({
        sessionId: session.id,
        userId: user.id,
        version: version.tag,
        vncPassword: session.vncPassword,
        env: {
          UNCIV_USER_ID: user.uncivUserId,
          UNCIV_LANGUAGE: toUncivLanguage(user.locale),
          UNCIV_MULTIPLAYER_SERVER: resolveGameMultiplayerServer(user, config),
        },
      });
      const [updated] = await this.db
        .update(gameSessions)
        .set({ containerId })
        .where(eq(gameSessions.id, session.id))
        .returning();
      return updated ?? session;
    } catch (error) {
      this.options.logger.error(
        { err: error, sessionId: session.id },
        'Game container start failed',
      );
      await this.markStopped(session.id, 'failed', 'start_failed');
      throw new AppError(500, 'SESSION_START_FAILED');
    }
  }

  async heartbeat(userId: string): Promise<GameSession> {
    const session = await this.getActive(userId);
    if (!session) throw new AppError(404, 'SESSION_NOT_FOUND');
    const [updated] = await this.db
      .update(gameSessions)
      .set({ lastSeenAt: new Date() })
      .where(eq(gameSessions.id, session.id))
      .returning();
    return updated ?? session;
  }

  async stop(sessionId: string, reason: string): Promise<void> {
    const session = await this.db.query.gameSessions.findFirst({
      where: eq(gameSessions.id, sessionId),
    });
    if (!session) throw new AppError(404, 'SESSION_NOT_FOUND');
    if (session.containerId) await this.options.docker.stopContainer(session.containerId);
    await this.markStopped(session.id, 'stopped', reason);
  }

  async stopForUser(userId: string, reason: string): Promise<void> {
    const session = await this.getActive(userId);
    if (!session) throw new AppError(404, 'SESSION_NOT_FOUND');
    await this.stop(session.id, reason);
  }

  /** Used by the reverse proxy: may this user reach the game stream of this session? */
  async canAccess(userId: string, sessionId: string): Promise<boolean> {
    const session = await this.db.query.gameSessions.findFirst({
      where: and(
        eq(gameSessions.id, sessionId),
        eq(gameSessions.userId, userId),
        inArray(gameSessions.status, ACTIVE_STATUSES),
      ),
    });
    return session !== undefined;
  }

  async deleteUserData(userId: string): Promise<void> {
    const session = await this.getActive(userId);
    if (session) await this.stop(session.id, 'account_deleted');
    await this.options.docker.removeUserVolume(userId);
  }

  /** Synchronises the database with Docker and enforces idle / duration limits. */
  async reconcile(): Promise<void> {
    const { config, docker, logger } = this.options;
    const now = Date.now();
    const idleLimit = new Date(now - config.SESSION_IDLE_TIMEOUT_MINUTES * 60_000);
    const durationLimit = new Date(now - config.SESSION_MAX_DURATION_HOURS * 3_600_000);

    const expired = await this.db.query.gameSessions.findMany({
      where: and(
        inArray(gameSessions.status, ACTIVE_STATUSES),
        or(lt(gameSessions.lastSeenAt, idleLimit), lt(gameSessions.createdAt, durationLimit)),
      ),
    });
    for (const session of expired) {
      const reason = session.createdAt < durationLimit ? 'max_duration' : 'idle';
      logger.info({ sessionId: session.id, reason }, 'Stopping game session');
      await this.stop(session.id, reason).catch((error: unknown) => {
        logger.error({ err: error, sessionId: session.id }, 'Failed to stop game session');
      });
    }

    const active = await this.db.query.gameSessions.findMany({
      where: inArray(gameSessions.status, ACTIVE_STATUSES),
    });
    await Promise.all(active.map((session) => this.refresh(session)));

    const known = new Set(active.map((session) => session.id));
    for (const [sessionId, containerId] of await docker.listGameSessionIds()) {
      if (!known.has(sessionId)) {
        logger.warn({ sessionId }, 'Removing orphan game container');
        await docker.stopContainer(containerId);
      }
    }
  }

  startScheduler(): void {
    const run = () => {
      this.reconcile().catch((error: unknown) => {
        this.options.logger.error({ err: error }, 'Session reconciliation failed');
      });
    };
    run();
    this.timer = setInterval(run, RECONCILE_INTERVAL_MS);
  }

  stopScheduler(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Updates the session status from the container state. */
  private async refresh(session: GameSession): Promise<GameSession> {
    if (!session.containerId) {
      if (Date.now() - session.createdAt.getTime() > START_TIMEOUT_MS) {
        return this.markStopped(session.id, 'failed', 'start_timeout');
      }
      return session;
    }

    const state = await this.options.docker.getContainerState(session.containerId);
    if (!state || state.exited) return this.markStopped(session.id, 'stopped', 'exited');
    if (state.unhealthy) {
      await this.options.docker.stopContainer(session.containerId);
      return this.markStopped(session.id, 'failed', 'crashed');
    }
    if (session.status === 'starting') {
      if (state.healthy) return this.setStatus(session, 'running');
      if (Date.now() - session.createdAt.getTime() > START_TIMEOUT_MS) {
        await this.options.docker.stopContainer(session.containerId);
        return this.markStopped(session.id, 'failed', 'start_timeout');
      }
    }
    return session;
  }

  private async setStatus(session: GameSession, status: GameSession['status']) {
    const [updated] = await this.db
      .update(gameSessions)
      .set({ status })
      .where(eq(gameSessions.id, session.id))
      .returning();
    return updated ?? session;
  }

  private async markStopped(
    sessionId: string,
    status: 'stopped' | 'failed',
    reason: string,
  ): Promise<GameSession> {
    const [updated] = await this.db
      .update(gameSessions)
      .set({ status, stopReason: reason, stoppedAt: new Date() })
      .where(eq(gameSessions.id, sessionId))
      .returning();
    if (!updated) throw new AppError(404, 'SESSION_NOT_FOUND');
    return updated;
  }
}
