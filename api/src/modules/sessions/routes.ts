import type { FastifyInstance } from 'fastify';
import { loadCurrentUser, requireUser } from '../../plugins/auth.js';
import { sessionIdFromPath, toSessionDto } from './service.js';

export async function sessionRoutes(app: FastifyInstance): Promise<void> {
  const { sessions } = app.services;

  app.get('/current', async (request) => {
    const session = await sessions.getActive(requireUser(request).id);
    return { session: session ? toSessionDto(session) : null };
  });

  app.post(
    '/',
    { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const session = await sessions.start(requireUser(request));
      return reply.code(201).send({ session: toSessionDto(session) });
    },
  );

  app.post('/current/heartbeat', async (request) => {
    const session = await sessions.heartbeat(requireUser(request).id);
    return { session: toSessionDto(session) };
  });

  app.delete('/current', async (request, reply) => {
    await sessions.stopForUser(requireUser(request).id, 'user');
    return reply.code(204).send();
  });

  /**
   * Traefik forward-auth endpoint protecting `/play/<sessionId>/…`:
   * only the owner of an active session may reach its game stream.
   */
  app.get('/authorize', { config: { public: true, rateLimit: false } }, async (request, reply) => {
    const forwardedUri = request.headers['x-forwarded-uri'];
    const path = typeof forwardedUri === 'string' ? (forwardedUri.split('?')[0] ?? '') : '';
    const sessionId = sessionIdFromPath(path);
    const user = await loadCurrentUser(request);
    if (!sessionId || !user) return reply.code(401).send();
    if (!(await sessions.canAccess(user.id, sessionId))) return reply.code(403).send();
    return reply.code(204).send();
  });
}
