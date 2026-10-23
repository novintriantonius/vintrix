import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';

// Passwordless Google & GitHub OAuth Handlers
export const authRouter = new Elysia({ prefix: '/auth' })
  .use(
    jwt({
      name: 'jwt',
      secret: process.env.JWT_SECRET || 'vintrix-super-secure-jwt-secret-oauth-key-32b',
    })
  )
  .get('/providers', () => ({
    providers: [
      {
        id: 'google',
        name: 'Google',
        authUrl: '/api/v1/auth/google',
        enabled: true,
      },
      {
        id: 'github',
        name: 'GitHub',
        authUrl: '/api/v1/auth/github',
        enabled: true,
      },
    ],
  }))
  .get('/google', ({ redirect }) => {
    const clientId = process.env.GOOGLE_CLIENT_ID || 'dummy-google-client-id';
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/callback/google';
    const scope = encodeURIComponent('openid profile email');
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline`;
    return redirect(authUrl);
  })
  .get('/github', ({ redirect }) => {
    const clientId = process.env.GITHUB_CLIENT_ID || 'dummy-github-client-id';
    const redirectUri = process.env.GITHUB_REDIRECT_URI || 'http://localhost:3000/auth/callback/github';
    const scope = encodeURIComponent('read:user user:email');
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}`;
    return redirect(authUrl);
  })
  .post(
    '/callback',
    async ({ body, jwt, set }) => {
      const { provider, code, email, name, avatarUrl } = body;

      // In production exchange code with OAuth provider tokens
      // For passwordless flow:
      const targetEmail = email || `${provider}.user@vintrix.ai`;
      const displayName = name || (provider === 'google' ? 'Google Developer' : 'GitHub Engineer');

      const token = await jwt.sign({
        sub: `usr-${provider}-${Date.now()}`,
        email: targetEmail,
        name: displayName,
        provider,
      });

      set.status = 200;
      return {
        token,
        user: {
          id: `usr-${provider}-${Date.now()}`,
          email: targetEmail,
          displayName,
          avatarUrl: avatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${targetEmail}`,
          provider,
        },
      };
    },
    {
      body: t.Object({
        provider: t.Union([t.Literal('google'), t.Literal('github')]),
        code: t.Optional(t.String()),
        email: t.Optional(t.String()),
        name: t.Optional(t.String()),
        avatarUrl: t.Optional(t.String()),
      }),
    }
  )
  .get('/me', async ({ jwt, headers, set }) => {
    const authHeader = headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      set.status = 401;
      return { error: 'Unauthorized: Missing bearer token' };
    }
    const token = authHeader.slice(7);
    const payload = await jwt.verify(token);
    if (!payload) {
      set.status = 401;
      return { error: 'Unauthorized: Invalid or expired token' };
    }
    return {
      authenticated: true,
      user: payload,
    };
  });
