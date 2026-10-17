// Test-only identity provider. It is never loaded by either application.
import { generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import { createServer } from 'node:http';

export function createAuthFixture(origin, webOrigin) {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const users = new Map();
  const refreshTokens = new Map();
  const confirmations = new Map();
  let refreshCount = 0;
  function userFor(email) {
    if (!users.has(email))
      users.set(email, {
        id: randomUUID(),
        email,
        aud: 'authenticated',
        role: 'authenticated',
        created_at: new Date().toISOString(),
        email_confirmed_at: new Date().toISOString(),
        app_metadata: { provider: 'email' },
        user_metadata: {},
        identities: [],
      });
    return users.get(email);
  }
  function session(user, sessionId = randomUUID(), lifetime = 3600) {
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(
      JSON.stringify({ alg: 'ES256', kid: 'platform-test', typ: 'JWT' }),
    ).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        sub: user.id,
        session_id: sessionId,
        email: user.email,
        iss: `${origin}/auth/v1`,
        aud: 'authenticated',
        role: 'authenticated',
        iat: now,
        exp: now + lifetime,
        is_anonymous: false,
      }),
    ).toString('base64url');
    const input = `${header}.${payload}`;
    const refreshToken = randomUUID();
    refreshTokens.set(refreshToken, { user, sessionId });
    return {
      access_token: `${input}.${sign('sha256', Buffer.from(input), { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`,
      refresh_token: refreshToken,
      token_type: 'bearer',
      expires_in: lifetime,
      user,
    };
  }
  return createServer(async (request, response) => {
    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': webOrigin,
      'Access-Control-Allow-Headers':
        'apikey, authorization, content-type, x-client-info, x-supabase-api-version',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    };
    const send = (status, value) => {
      response.writeHead(status, headers);
      response.end(status === 204 ? undefined : JSON.stringify(value));
    };
    if (request.method === 'OPTIONS') return send(204);
    let text = '';
    for await (const chunk of request) text += chunk;
    const body = text ? JSON.parse(text) : {};
    const url = new URL(request.url, origin);
    if (url.pathname === '/auth/v1/.well-known/jwks.json')
      return send(200, {
        keys: [
          {
            ...publicKey.export({ format: 'jwk' }),
            kid: 'platform-test',
            alg: 'ES256',
            use: 'sig',
          },
        ],
      });
    if (url.pathname === '/test/stats') return send(200, { refreshCount });
    if (url.pathname === '/auth/v1/signup') {
      const user = userFor(body.email);
      confirmations.set(`confirmation-${user.id}`, user);
      return send(200, user);
    }
    if (url.pathname === '/auth/v1/token') {
      if (url.searchParams.get('grant_type') === 'refresh_token') {
        const saved = refreshTokens.get(body.refresh_token);
        if (!saved)
          return send(400, { code: 'refresh_token_not_found', msg: 'Invalid refresh token' });
        refreshCount += 1;
        refreshTokens.delete(body.refresh_token);
        return send(200, session(saved.user, saved.sessionId));
      }
      if (url.searchParams.get('grant_type') === 'pkce') {
        const user = confirmations.get(body.auth_code);
        if (!user || !body.code_verifier)
          return send(400, { code: 'bad_code_verifier', msg: 'Invalid confirmation' });
        confirmations.delete(body.auth_code);
        return send(200, session(user));
      }
      if (body.email === 'invalid@example.test')
        return send(400, { code: 'invalid_credentials', msg: 'Invalid login credentials' });
      return send(
        200,
        session(userFor(body.email), undefined, body.email?.startsWith('expiring-') ? 5 : 3600),
      );
    }
    if (url.pathname === '/auth/v1/logout') {
      try {
        const payload = JSON.parse(
          Buffer.from(request.headers.authorization.split(' ')[1].split('.')[1], 'base64url'),
        );
        for (const [key, value] of refreshTokens)
          if (value.sessionId === payload.session_id) refreshTokens.delete(key);
      } catch {
        /* The actual JWT boundary is tested in NestJS. */
      }
      return send(204);
    }
    return send(400, { code: 'unexpected_fixture_request', msg: 'Unsupported test request' });
  });
}
