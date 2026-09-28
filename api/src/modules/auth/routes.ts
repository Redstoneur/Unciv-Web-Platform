import argon2 from 'argon2';
import { eq, or, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { users } from '../../db/schema.js';
import { uniqueViolation } from '../../lib/db-errors.js';
import { AppError } from '../../lib/errors.js';
import { DEFAULT_LOCALE } from '../../lib/locales.js';
import { parseOrThrow } from '../../lib/validation.js';
import { clearSessionCookie, loadCurrentUser, setSessionCookie } from '../../plugins/auth.js';
import { toUserDto } from '../users/dto.js';
import { emailSchema, localeSchema, passwordSchema, usernameSchema } from '../users/schemas.js';

const registerSchema = z.object({
  email: emailSchema,
  username: usernameSchema,
  password: passwordSchema,
  locale: localeSchema.default(DEFAULT_LOCALE),
});

const loginSchema = z.object({
  login: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(128),
});

const authRateLimit = { rateLimit: { max: 10, timeWindow: '1 minute' } };

const dummyPasswordHash = argon2.hash('unciv-web-platform-dummy-password');

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const { db, config } = app.services;

  app.post('/register', { config: { public: true, ...authRateLimit } }, async (request, reply) => {
    if (!config.REGISTRATION_ENABLED) throw new AppError(403, 'AUTH_REGISTRATION_DISABLED');
    const body = parseOrThrow(registerSchema, request.body);

    let user;
    try {
      [user] = await db
        .insert(users)
        .values({
          email: body.email,
          username: body.username,
          passwordHash: await argon2.hash(body.password),
          locale: body.locale,
          role: config.adminEmails.has(body.email) ? 'admin' : 'user',
        })
        .returning();
    } catch (error) {
      const constraint = uniqueViolation(error);
      if (constraint === 'users_email_unique') throw new AppError(409, 'AUTH_EMAIL_TAKEN');
      if (constraint === 'users_username_unique') throw new AppError(409, 'AUTH_USERNAME_TAKEN');
      throw error;
    }
    if (!user) throw new AppError(500, 'INTERNAL_ERROR');

    await setSessionCookie(reply, user);
    return reply.code(201).send(toUserDto(user, config));
  });

  app.post('/login', { config: { public: true, ...authRateLimit } }, async (request, reply) => {
    const body = parseOrThrow(loginSchema, request.body);
    const login = body.login.toLowerCase();

    const user = await db.query.users.findFirst({
      where: or(sql`lower(${users.email}) = ${login}`, sql`lower(${users.username}) = ${login}`),
    });
    // Always run a hash verification so response time does not reveal whether the account exists.
    const passwordValid = await argon2.verify(
      user?.passwordHash ?? (await dummyPasswordHash),
      body.password,
    );
    if (!user || !passwordValid) throw new AppError(401, 'AUTH_INVALID_CREDENTIALS');
    if (user.role !== 'admin' && config.adminEmails.has(user.email.toLowerCase())) {
      await db.update(users).set({ role: 'admin' }).where(eq(users.id, user.id));
      user.role = 'admin';
    }

    await setSessionCookie(reply, user);
    return toUserDto(user, config);
  });

  app.post('/logout', { config: { public: true } }, async (_request, reply) => {
    clearSessionCookie(reply);
    return reply.code(204).send();
  });

  app.get('/me', { config: { public: true } }, async (request, reply) => {
    const user = await loadCurrentUser(request);
    if (!user) {
      clearSessionCookie(reply);
      throw new AppError(401, 'UNAUTHORIZED');
    }
    return toUserDto(user, config);
  });
}
