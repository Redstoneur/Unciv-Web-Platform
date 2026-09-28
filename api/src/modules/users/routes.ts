import argon2 from 'argon2';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { users } from '../../db/schema.js';
import { uniqueViolation } from '../../lib/db-errors.js';
import { AppError } from '../../lib/errors.js';
import { parseOrThrow } from '../../lib/validation.js';
import { clearSessionCookie, requireUser } from '../../plugins/auth.js';
import { toUserDto } from './dto.js';
import { httpUrlSchema, localeSchema, passwordSchema, usernameSchema } from './schemas.js';

const updateProfileSchema = z
  .object({
    username: usernameSchema,
    locale: localeSchema,
    multiplayerMode: z.enum(['official', 'platform', 'custom']),
    customMultiplayerUrl: httpUrlSchema.nullable(),
    uncivUserId: z.uuid(),
  })
  .partial();

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});

const deleteAccountSchema = z.object({
  password: z.string().min(1).max(128),
});

export async function userRoutes(app: FastifyInstance): Promise<void> {
  const { db, config, sessions } = app.services;

  app.patch('/me', async (request) => {
    const user = requireUser(request);
    const changes = parseOrThrow(updateProfileSchema, request.body);

    const multiplayerMode = changes.multiplayerMode ?? user.multiplayerMode;
    const customMultiplayerUrl =
      changes.customMultiplayerUrl !== undefined
        ? changes.customMultiplayerUrl
        : user.customMultiplayerUrl;
    if (multiplayerMode === 'platform' && !config.multiplayerServerPublicUrl) {
      throw new AppError(400, 'MULTIPLAYER_PLATFORM_DISABLED');
    }
    if (multiplayerMode === 'custom' && !customMultiplayerUrl) {
      throw new AppError(400, 'MULTIPLAYER_CUSTOM_URL_REQUIRED');
    }

    try {
      const [updated] = await db
        .update(users)
        .set(changes)
        .where(eq(users.id, user.id))
        .returning();
      if (!updated) throw new AppError(404, 'NOT_FOUND');
      return toUserDto(updated, config);
    } catch (error) {
      if (uniqueViolation(error) === 'users_username_unique') {
        throw new AppError(409, 'AUTH_USERNAME_TAKEN');
      }
      throw error;
    }
  });

  app.post('/me/password', async (request, reply) => {
    const user = requireUser(request);
    const body = parseOrThrow(changePasswordSchema, request.body);
    if (!(await argon2.verify(user.passwordHash, body.currentPassword))) {
      throw new AppError(400, 'AUTH_WRONG_PASSWORD');
    }
    await db
      .update(users)
      .set({ passwordHash: await argon2.hash(body.newPassword) })
      .where(eq(users.id, user.id));
    return reply.code(204).send();
  });

  app.delete('/me', async (request, reply) => {
    const user = requireUser(request);
    const body = parseOrThrow(deleteAccountSchema, request.body);
    if (!(await argon2.verify(user.passwordHash, body.password))) {
      throw new AppError(400, 'AUTH_WRONG_PASSWORD');
    }
    await sessions.deleteUserData(user.id);
    await db.delete(users).where(eq(users.id, user.id));
    clearSessionCookie(reply);
    return reply.code(204).send();
  });
}
