import { desc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { users } from '../../db/schema.js';
import { AppError } from '../../lib/errors.js';
import { parseOrThrow } from '../../lib/validation.js';
import { requireUser } from '../../plugins/auth.js';
import { toUserDto } from '../users/dto.js';
import { toVersionDto } from '../versions/dto.js';

const adminOnly = { config: { admin: true } };
const tagParams = z.object({ tag: z.string().min(1).max(64) });
const idParams = z.object({ id: z.uuid() });
const installSchema = z.object({ tag: z.string().min(1).max(64).optional() });
const roleSchema = z.object({ role: z.enum(['user', 'admin']) });

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  const { db, config, versions, sessions, docker } = app.services;

  app.get('/overview', adminOnly, async () => {
    const [allUsers, activeSessions, current] = await Promise.all([
      db.$count(users),
      sessions.listActive(),
      versions.getCurrent(),
    ]);
    return {
      users: allUsers,
      activeSessions: activeSessions.length,
      maxSessions: config.MAX_ACTIVE_SESSIONS,
      currentVersion: current?.tag ?? null,
      dockerAvailable: await docker.ping(),
    };
  });

  app.get('/versions', adminOnly, async () => (await versions.list()).map(toVersionDto));

  app.post('/versions/check', adminOnly, async () => versions.checkForUpdates());

  app.post('/versions', adminOnly, async (request) => {
    const { tag } = parseOrThrow(installSchema, request.body ?? {});
    return toVersionDto(await versions.install(tag));
  });

  app.post('/versions/:tag/activate', adminOnly, async (request) => {
    const { tag } = parseOrThrow(tagParams, request.params);
    return toVersionDto(await versions.activate(tag));
  });

  app.get('/sessions', adminOnly, async () => {
    const rows = await sessions.listActive();
    return rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      lastSeenAt: row.lastSeenAt.toISOString(),
    }));
  });

  app.delete('/sessions/:id', adminOnly, async (request, reply) => {
    const { id } = parseOrThrow(idParams, request.params);
    await sessions.stop(id, 'admin');
    return reply.code(204).send();
  });

  app.get('/users', adminOnly, async () => {
    const rows = await db.query.users.findMany({ orderBy: desc(users.createdAt), limit: 500 });
    return rows.map((user) => toUserDto(user, config));
  });

  app.patch('/users/:id', adminOnly, async (request) => {
    const { id } = parseOrThrow(idParams, request.params);
    const { role } = parseOrThrow(roleSchema, request.body);
    if (id === requireUser(request).id && role !== 'admin') {
      throw new AppError(400, 'CANNOT_DEMOTE_SELF');
    }
    const [updated] = await db.update(users).set({ role }).where(eq(users.id, id)).returning();
    if (!updated) throw new AppError(404, 'NOT_FOUND');
    return toUserDto(updated, config);
  });

  app.delete('/users/:id', adminOnly, async (request, reply) => {
    const { id } = parseOrThrow(idParams, request.params);
    if (id === requireUser(request).id) throw new AppError(400, 'CANNOT_DELETE_SELF');
    await sessions.deleteUserData(id);
    const deleted = await db.delete(users).where(eq(users.id, id)).returning({ id: users.id });
    if (deleted.length === 0) throw new AppError(404, 'NOT_FOUND');
    return reply.code(204).send();
  });
}
