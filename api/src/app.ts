import fastifyRateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import { AppError, type ErrorCode } from './lib/errors.js';
import { adminRoutes } from './modules/admin/routes.js';
import { authRoutes } from './modules/auth/routes.js';
import { platformRoutes } from './modules/platform/routes.js';
import { sessionRoutes } from './modules/sessions/routes.js';
import { userRoutes } from './modules/users/routes.js';
import { setupAuth } from './plugins/auth.js';
import type { Services } from './types.js';
import './types.js';

export interface ErrorBody {
  error: { code: ErrorCode; message: string };
}

const HTTP_ERROR_CODES: Record<number, ErrorCode> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  429: 'RATE_LIMITED',
};

export async function buildApp(
  services: Services,
  options: FastifyServerOptions = {},
): Promise<FastifyInstance> {
  const app = Fastify({
    trustProxy: true,
    bodyLimit: 64 * 1024,
    ...options,
  });
  app.decorate('services', services);

  app.setErrorHandler<Error & { statusCode?: number }>((error, request, reply) => {
    if (error instanceof AppError) {
      const body: ErrorBody = { error: { code: error.code, message: error.message } };
      return reply.code(error.statusCode).send(body);
    }
    const statusCode = error.statusCode ?? 500;
    if (statusCode >= 500) request.log.error({ err: error }, 'Unhandled error');
    const body: ErrorBody = {
      error: {
        code: HTTP_ERROR_CODES[statusCode] ?? 'INTERNAL_ERROR',
        message: statusCode >= 500 ? 'Internal server error' : error.message,
      },
    };
    return reply.code(statusCode).send(body);
  });

  app.setNotFoundHandler((_request, reply) => {
    const body: ErrorBody = { error: { code: 'NOT_FOUND', message: 'Route not found' } };
    return reply.code(404).send(body);
  });

  await app.register(fastifyRateLimit, { global: true, max: 300, timeWindow: '1 minute' });
  await setupAuth(app);

  await app.register(
    async (api) => {
      await api.register(platformRoutes);
      await api.register(authRoutes, { prefix: '/auth' });
      await api.register(userRoutes, { prefix: '/users' });
      await api.register(sessionRoutes, { prefix: '/sessions' });
      await api.register(adminRoutes, { prefix: '/admin' });
    },
    { prefix: '/api' },
  );

  return app;
}
