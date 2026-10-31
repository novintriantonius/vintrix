import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { workspacesRouter } from './routes/workspaces';
import { sourcesRouter } from './routes/sources';
import { aiRouter } from './routes/ai';
import { authRouter } from './routes/auth';
import { graphRouter } from './routes/graph';

const app = new Elysia()
  .use(cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
  }))
  .use(
    swagger({
      documentation: {
        info: {
          title: 'Vintrix API Documentation',
          version: '0.1.0',
          description: 'REST API for Vintrix Multi-Repo Codebase Knowledge Platform',
        },
      },
    }),
  )
  .get('/', () => ({
    message: 'Welcome to Vintrix API',
    status: 'online',
    timestamp: new Date().toISOString(),
  }))
  .get('/api/health', () => ({
    status: 'ok',
    uptime: process.uptime(),
  }))
  .group('/api/v1', (group) =>
    group
      .use(authRouter)
      .use(workspacesRouter)
      .use(sourcesRouter)
      .use(aiRouter)
      .use(graphRouter),
  )
  .listen(Number(process.env.PORT) || 3001);

console.log(`🚀 Vintrix API running at http://${app.server?.hostname}:${app.server?.port}`);
console.log(`📄 Swagger documentation at http://${app.server?.hostname}:${app.server?.port}/swagger`);

export type App = typeof app;
