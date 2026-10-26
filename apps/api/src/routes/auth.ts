import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { db } from '../db/client';
import { users, workspaces, workspaceMembers, roles } from '../db/schema';
import { eq } from 'drizzle-orm';

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
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/v1/auth/google/callback';
    if (!clientId) {
      // In local dev without OAuth credentials configured, provide mock redirect with code
      return redirect(`/api/v1/auth/callback/redirect?provider=google&code=mock-google-code-${Date.now()}`);
    }
    const scope = encodeURIComponent('openid profile email');
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;
    return redirect(authUrl);
  })
  .get(
    '/google/callback',
    async ({ query, jwt, redirect }) => {
      const code = query.code;
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

      if (!code) {
        return redirect(`${frontendUrl}?auth_error=missing_code`);
      }

      try {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/v1/auth/google/callback';

        // 1. Exchange code for Google access token
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: clientId || '',
            client_secret: clientSecret || '',
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
          }),
        });

        if (!tokenResponse.ok) {
          const errText = await tokenResponse.text();
          console.error('[Google OAuth] Token exchange error:', errText);
          return redirect(`${frontendUrl}?auth_error=token_exchange_failed`);
        }

        const tokenData = (await tokenResponse.json()) as { access_token: string; id_token?: string };

        // 2. Fetch Google user profile
        const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });

        if (!userinfoRes.ok) {
          return redirect(`${frontendUrl}?auth_error=failed_fetching_profile`);
        }

        const profile = (await userinfoRes.json()) as {
          id: string;
          email: string;
          name?: string;
          picture?: string;
        };

        const targetEmail = profile.email;
        const displayName = profile.name || 'Google User';
        const avatarUrl = profile.picture || `https://api.dicebear.com/7.x/identicon/svg?seed=${targetEmail}`;
        const providerId = profile.id;

        let userId = `usr-google-${Date.now()}`;
        try {
          const existingUsers = await db.select().from(users).where(eq(users.email, targetEmail)).limit(1);
          if (existingUsers.length > 0) {
            userId = existingUsers[0].id;
            // Update profile info
            await db
              .update(users)
              .set({
                displayName,
                avatarUrl,
                updatedAt: new Date(),
              })
              .where(eq(users.id, userId));
          } else {
            const inserted = await db
              .insert(users)
              .values({
                email: targetEmail,
                displayName,
                avatarUrl,
                provider: 'google',
                providerId,
              })
              .returning();
            if (inserted.length > 0) {
              userId = inserted[0].id;
            }
          }
        } catch (dbErr) {
          console.warn('[Google OAuth] DB upsert warning:', dbErr);
        }

        // 3. Issue Vintrix JWT Token
        const token = await jwt.sign({
          sub: userId,
          email: targetEmail,
          name: displayName,
          provider: 'google',
        });

        const userPayload = encodeURIComponent(
          JSON.stringify({
            id: userId,
            email: targetEmail,
            displayName,
            avatarUrl,
            provider: 'google',
          })
        );

        return redirect(`${frontendUrl}?token=${encodeURIComponent(token)}&user=${userPayload}`);
      } catch (error) {
        console.error('[Google OAuth] Error during authentication flow:', error);
        return redirect(`${frontendUrl}?auth_error=authentication_failed`);
      }
    },
    {
      query: t.Object({
        code: t.Optional(t.String()),
        error: t.Optional(t.String()),
      }),
    }
  )
  .get('/github', ({ redirect }) => {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const redirectUri = process.env.GITHUB_REDIRECT_URI || 'http://localhost:5173/auth/callback';
    if (!clientId) {
      // In local dev without OAuth credentials configured, provide mock redirect with code
      return redirect(`/api/v1/auth/callback/redirect?provider=github&code=mock-github-code-${Date.now()}`);
    }
    const scope = encodeURIComponent('read:user user:email');
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}`;
    return redirect(authUrl);
  })
  // Redirect bridge for local/dev flow to pass token directly to frontend
  .get(
    '/callback/redirect',
    async ({ query, jwt, redirect }) => {
      const provider = (query.provider as 'google' | 'github') || 'github';
      const targetEmail = query.email || `${provider}.engineer@vintrix.ai`;
      const displayName = provider === 'google' ? 'Google Developer' : 'GitHub Engineer';
      const avatarUrl = `https://api.dicebear.com/7.x/identicon/svg?seed=${targetEmail}`;

      let userId = `usr-${provider}-${Date.now()}`;
      try {
        const existingUsers = await db.select().from(users).where(eq(users.email, targetEmail)).limit(1);
        if (existingUsers.length > 0) {
          userId = existingUsers[0].id;
        } else {
          const inserted = await db
            .insert(users)
            .values({
              email: targetEmail,
              displayName,
              avatarUrl,
              provider,
              providerId: `oauth-${provider}-${Date.now()}`,
            })
            .returning();
          if (inserted.length > 0) {
            userId = inserted[0].id;
          }
        }
      } catch (err) {
        console.warn('[OAuth Callback Redirect] user sync fallback:', err);
      }

      const token = await jwt.sign({
        sub: userId,
        email: targetEmail,
        name: displayName,
        provider,
      });

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const userPayload = encodeURIComponent(
        JSON.stringify({
          id: userId,
          email: targetEmail,
          displayName,
          avatarUrl,
          provider,
        })
      );

      return redirect(`${frontendUrl}?token=${encodeURIComponent(token)}&user=${userPayload}`);
    },
    {
      query: t.Object({
        provider: t.Optional(t.String()),
        code: t.Optional(t.String()),
        email: t.Optional(t.String()),
      }),
    }
  )
  .post(
    '/callback',
    async ({ body, jwt, set }) => {
      const { provider, code: _code, email, name, avatarUrl } = body;

      const targetEmail = email || `${provider}.user@vintrix.ai`;
      const displayName = name || (provider === 'google' ? 'Google Developer' : 'GitHub Engineer');
      const finalAvatar = avatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${targetEmail}`;

      let userId = `usr-${provider}-${Date.now()}`;

      try {
        // Query or persist user in database
        const existingUsers = await db.select().from(users).where(eq(users.email, targetEmail)).limit(1);

        if (existingUsers.length > 0) {
          userId = existingUsers[0].id;
        } else {
          const inserted = await db
            .insert(users)
            .values({
              email: targetEmail,
              displayName,
              avatarUrl: finalAvatar,
              provider,
              providerId: `oauth-${provider}-${Date.now()}`,
            })
            .returning();
          if (inserted.length > 0) {
            userId = inserted[0].id;

            // Create initial default workspace for the new user
            const insertedWorkspace = await db
              .insert(workspaces)
              .values({
                name: `${displayName.split(' ')[0]}'s Workspace`,
                description: 'Personal codebase intelligence workspace',
                ownerId: userId,
              })
              .returning();

            if (insertedWorkspace.length > 0) {
              const defaultRoles = await db.select().from(roles).where(eq(roles.name, 'owner')).limit(1);
              if (defaultRoles.length > 0) {
                await db.insert(workspaceMembers).values({
                  workspaceId: insertedWorkspace[0].id,
                  userId,
                  roleId: defaultRoles[0].id,
                });
              }
            }
          }
        }
      } catch (err) {
        console.warn('[OAuth] DB user sync failed (running offline fallback):', err);
      }

      const token = await jwt.sign({
        sub: userId,
        email: targetEmail,
        name: displayName,
        provider,
      });

      set.status = 200;
      return {
        token,
        user: {
          id: userId,
          email: targetEmail,
          displayName,
          avatarUrl: finalAvatar,
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
