import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';
import { createServerClient } from '@supabase/ssr';

const web = process.env.TEST_WEB_URL;
const api = process.env.TEST_API_URL;
const auth = process.env.TEST_AUTH_URL;
assert.ok(web && api && auth, 'Run through pnpm test:platform with its isolated servers.');
function browserSession() {
  const jar = new Map();
  const client = createServerClient(auth, 'sb_publishable_platform_test', {
    cookies: {
      getAll: () => [...jar.values()],
      setAll: (values) => {
        for (const value of values) {
          if (value.value) jar.set(value.name, value);
          else jar.delete(value.name);
        }
      },
    },
    auth: { autoRefreshToken: false },
  });
  return {
    client,
    cookie: () =>
      [...jar.values()].map(({ name, value }) => `${name}=${encodeURIComponent(value)}`).join('; '),
  };
}
async function signIn(email = `${randomUUID()}@example.test`) {
  const session = browserSession();
  const { data, error } = await session.client.auth.signInWithPassword({
    email,
    password: 'Fixture-only-password-2026!',
  });
  assert.equal(error, null);
  return { ...session, token: data.session.access_token };
}
function page(path, cookie) {
  return fetch(`${web}${path}`, { redirect: 'manual', headers: cookie ? { Cookie: cookie } : {} });
}
async function createWorkspace(session) {
  const slug = `platform-${randomUUID().slice(0, 8)}`;
  const response = await fetch(`${api}/organizations`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Platform Integration Team', slug }),
  });
  assert.equal(response.status, 201);
  return response.json();
}

test('public routes render and protected routes redirect without a session', async () => {
  for (const path of ['/', '/login', '/signup']) assert.equal((await page(path)).status, 200);
  for (const path of ['/onboarding', '/unknown-workspace/dashboard']) {
    const response = await page(path);
    assert.equal(response.status, 307);
    assert.equal(response.headers.get('location'), '/login');
  }
});

test('signup without a session and PKCE confirmation establish server-readable cookies', async () => {
  const session = browserSession();
  const { data, error } = await session.client.auth.signUp({
    email: `${randomUUID()}@example.test`,
    password: 'Fixture-only-password-2026!',
    options: { emailRedirectTo: `${web}/auth/callback` },
  });
  assert.equal(error, null);
  assert.equal(data.session, null);
  const response = await page(`/auth/callback?code=confirmation-${data.user.id}`, session.cookie());
  assert.equal(response.status, 303);
  assert.equal(response.headers.get('location'), '/onboarding');
  assert.ok(response.headers.getSetCookie().some((cookie) => cookie.includes('auth-token')));
  const confirmedCookies = response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ');
  assert.equal((await page('/onboarding', confirmedCookies)).status, 200);
  const invalid = await page('/auth/callback?code=invalid&next=https://untrusted.example');
  assert.equal(invalid.headers.get('location'), '/login?error=confirmation');
});

test('login cookies survive repeated requests, existing workspaces appear, and other tenants are denied', async () => {
  const owner = await signIn();
  const organization = await createWorkspace(owner);
  for (let index = 0; index < 2; index += 1) {
    const onboarding = await page('/onboarding', owner.cookie());
    assert.equal(onboarding.status, 200);
    assert.match(await onboarding.text(), /Your workspaces/);
    const dashboard = await page(`/${organization.slug}/dashboard`, owner.cookie());
    assert.equal(dashboard.status, 200);
    assert.match(await dashboard.text(), /Your response workspace is ready/);
  }
  const outsider = await signIn();
  const denied = await page(`/${organization.slug}/dashboard`, outsider.cookie());
  assert.match(await denied.text(), /Workspace unavailable/);
});

test('Proxy refreshes expired JWT cookies before rendering protected tenant data', async () => {
  const session = await signIn(`expiring-${randomUUID()}@example.test`);
  const organization = await createWorkspace(session);
  const before = await (await fetch(`${auth}/test/stats`)).json();
  await delay(6000);
  const response = await page(`/${organization.slug}/dashboard`, session.cookie());
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Platform Integration Team/);
  assert.ok(response.headers.getSetCookie().some((cookie) => cookie.includes('auth-token')));
  assert.match(response.headers.get('cache-control'), /no-store/);
  const after = await (await fetch(`${auth}/test/stats`)).json();
  assert.ok(after.refreshCount > before.refreshCount);
});

test('logout clears cookies and replaying the old session cannot reopen protected pages', async () => {
  const session = await signIn();
  const organization = await createWorkspace(session);
  const oldCookie = session.cookie();
  const response = await fetch(`${api}/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.token}` },
  });
  assert.equal(response.status, 204);
  const { error } = await session.client.auth.signOut({ scope: 'local' });
  assert.equal(error, null);
  const cleared = await page('/onboarding', session.cookie());
  assert.equal(cleared.status, 307);
  assert.equal(cleared.headers.get('location'), '/login');
  const replayed = await page(`/${organization.slug}/dashboard`, oldCookie);
  assert.equal(replayed.status, 307);
  assert.equal(replayed.headers.get('location'), '/login');
});
