import fastifyCookie from '@fastify/cookie';
import fastifyJwt from '@fastify/jwt';
import { eq } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { users, type User } from '../db/schema.js';
import { AppError } from '../lib/errors.js';

export const SESSION_COOKIE = 'unciv_session';
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * Registers cookie based JWT authentication.
 * Every route requires an authenticated user unless its config sets `public: true`.
 */
export async function setupAuth(app: FastifyInstance): Promise<void> {
  const { config } = app.services;

  await app.register(fastifyCookie);
  await app.register(fastifyJwt, {
    secret: config.JWT_SECRET,
    cookie: { cookieName: SESSION_COOKIE, signed: false },
    sign: { expiresIn: SESSION_TTL_SECONDS },
  });

  app.decorateRequest('currentUser', null);

  app.addHook('onRequest', async (request) => {
    if (!request.routeOptions.url) return;
    const routeConfig = request.routeOptions.config;
    if (routeConfig.public) return;

    const user = await loadCurrentUser(request);
    if (!user) throw new AppError(401, 'UNAUTHORIZED');
    if (routeConfig.admin && user.role !== 'admin') throw new AppError(403, 'FORBIDDEN');
  });
}

export async function loadCurrentUser(request: FastifyRequest): Promise<User | null> {
  if (request.currentUser) return request.currentUser;
  let userId: string;
  try {
    userId = (await request.jwtVerify<{ sub: string }>({ onlyCookie: true })).sub;
  } catch {
    return null;
  }
  const user = await request.server.services.db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  request.currentUser = user ?? null;
  return request.currentUser;
}

export function requireUser(request: FastifyRequest): User {
  if (!request.currentUser) throw new AppError(401, 'UNAUTHORIZED');
  return request.currentUser;
}

export async function setSessionCookie(reply: FastifyReply, user: User): Promise<void> {
  const token = await reply.jwtSign({ sub: user.id });
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: reply.server.services.config.cookieSecure,
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE, { path: '/' });
}
