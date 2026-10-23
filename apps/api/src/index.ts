import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { workspacesRouter } from './routes/workspaces';
import { sourcesRouter } from './routes/sources';
import { aiRouter } from './routes/ai';

const app = new Elysia()
  .use(cors())
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
      .use(workspacesRouter)
      .use(sourcesRouter)
      .use(aiRouter)
      .get('/graph', () => ({
        nodes: [
          { id: '1', label: 'AuthService', type: 'class', layer: 'service', path: 'src/auth/service.ts' },
          { id: '2', label: 'AuthController', type: 'class', layer: 'api', path: 'src/auth/controller.ts' },
          { id: '3', label: 'UserRepository', type: 'class', layer: 'data', path: 'src/user/repository.ts' },
        ],
        edges: [
          { id: 'e1-2', source: '2', target: '1', type: 'calls' },
          { id: 'e1-3', source: '1', target: '3', type: 'calls' },
        ],
      })),
  )
  .listen(3001);

console.log(`🚀 Vintrix API running at http://${app.server?.hostname}:${app.server?.port}`);
console.log(`📄 Swagger documentation at http://${app.server?.hostname}:${app.server?.port}/swagger`);

export type App = typeof app;
