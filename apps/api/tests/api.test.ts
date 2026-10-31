import { describe, expect, it } from 'bun:test';
import { Elysia } from 'elysia';
import { workspacesRouter } from '../src/routes/workspaces';
import { authRouter } from '../src/routes/auth';

describe('HTTP API Endpoints & Routes', () => {
  const app = new Elysia()
    .get('/', () => ({
      message: 'Welcome to Vintrix API',
      status: 'online',
    }))
    .get('/api/health', () => ({
      status: 'ok',
      uptime: process.uptime(),
    }))
    .group('/api/v1', (group) => group.use(authRouter).use(workspacesRouter));

  it('GET / returns online message', async () => {
    const res = await app.handle(new Request('http://localhost/'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('online');
    expect(body.message).toContain('Vintrix API');
  });

  it('GET /api/health returns health status ok', async () => {
    const res = await app.handle(new Request('http://localhost/api/health'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(typeof body.uptime).toBe('number');
  });

  it('GET /api/v1/workspaces returns 401 without bearer token', async () => {
    const res = await app.handle(new Request('http://localhost/api/v1/workspaces'));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.message).toContain('Unauthorized');
  });

  it('GET /api/v1/auth/me returns 401 without token', async () => {
    const res = await app.handle(new Request('http://localhost/api/v1/auth/me'));
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/auth/providers returns available auth providers', async () => {
    const res = await app.handle(new Request('http://localhost/api/v1/auth/providers'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.providers).toBeDefined();
    expect(body.providers.length).toBeGreaterThan(0);
  });
});
