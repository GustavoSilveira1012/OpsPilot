import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';
import { createServerClient } from '@supabase/ssr';
const apiRequire = createRequire(new URL('../../api/package.json', import.meta.url));
const pg = apiRequire('pg');

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
  return {
    ...session,
    token: data.session.access_token,
    userId: data.user.id,
    email: data.user.email,
  };
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

test('service ownership renders real members, persists edits and disappears after archival', async () => {
  const owner = await signIn();
  const organization = await createWorkspace(owner);
  const endpoint = `${api}/organizations/${organization.slug}/services`;
  const headers = { Authorization: `Bearer ${owner.token}`, 'Content-Type': 'application/json' };
  const created = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'Platform Ownership Service',
      slug: 'platform-ownership-service',
    }),
  });
  assert.equal(created.status, 201);
  const service = await created.json();
  const route = `/${organization.slug}/services/${service.id}`;
  const initial = await page(route, owner.cookie());
  assert.equal(initial.status, 200);
  const html = await initial.text();
  assert.match(html, /Service ownership/);
  assert.match(html, /Assign an active workspace member/);
  assert.ok(html.includes(owner.email));
  const members = await fetch(`${api}/organizations/${organization.slug}/members`, { headers });
  assert.equal(members.status, 200);
  assert.deepEqual(
    (await members.json()).map((member) => member.userId),
    [owner.userId],
  );
  assert.equal(
    (await fetch(`${endpoint}/${service.id}/owners/${owner.userId}`, { method: 'PUT', headers }))
      .status,
    204,
  );
  const assigned = await page(route, owner.cookie());
  assert.match(await assigned.text(), /Remove .* as owner/);
  const edited = await fetch(`${endpoint}/${service.id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ name: 'Edited Ownership Service', status: 'DEGRADED' }),
  });
  assert.equal(edited.status, 200);
  assert.match(await (await page(route, owner.cookie())).text(), /Edited Ownership Service/);
  assert.equal(
    (await fetch(`${endpoint}/${service.id}/owners/${owner.userId}`, { method: 'DELETE', headers }))
      .status,
    204,
  );
  assert.match(await (await page(route, owner.cookie())).text(), /No active owners assigned/);
  assert.equal(
    (await fetch(`${endpoint}/${service.id}`, { method: 'DELETE', headers })).status,
    204,
  );
  assert.match(await (await page(route, owner.cookie())).text(), /Workspace unavailable/);
  const catalog = await page(`/${organization.slug}/services`, owner.cookie());
  assert.equal(catalog.status, 200);
  assert.ok(!(await catalog.text()).includes('Edited Ownership Service'));
});

test('ordinary members see ownership without manager controls and outsiders cannot open service details', async () => {
  const owner = await signIn();
  const member = await signIn();
  const outsider = await signIn();
  const organization = await createWorkspace(owner);
  const client = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
  await client.connect();
  try {
    await client.query(
      'INSERT INTO users (id, email, display_name, updated_at) VALUES ($1, $2, $3, now())',
      [member.userId, member.email, 'Read-only service member'],
    );
    await client.query(
      "INSERT INTO memberships (organization_id, user_id, role, status, updated_at) VALUES ($1, $2, 'MEMBER', 'ACTIVE', now())",
      [organization.id, member.userId],
    );
  } finally {
    await client.end();
  }
  const headers = { Authorization: `Bearer ${owner.token}`, 'Content-Type': 'application/json' };
  const endpoint = `${api}/organizations/${organization.slug}/services`;
  const created = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: 'Read-only Ownership Service', slug: 'read-only-service' }),
  });
  assert.equal(created.status, 201);
  const service = await created.json();
  assert.equal(
    (await fetch(`${endpoint}/${service.id}/owners/${member.userId}`, { method: 'PUT', headers }))
      .status,
    204,
  );
  const path = `/${organization.slug}/services/${service.id}`;
  const response = await page(path, member.cookie());
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Read-only service member/);
  assert.match(html, /Workspace owners and admins manage service ownership/);
  assert.ok(!html.includes('Assign an active workspace member'));
  assert.ok(!html.includes('Archive service'));
  assert.match(await (await page(path, outsider.cookie())).text(), /Workspace unavailable/);
});

test('incident catalog and detail routes render real API data and enforce workspace isolation', async () => {
  const owner = await signIn();
  const outsider = await signIn();
  const organization = await createWorkspace(owner);
  const base = `${api}/organizations/${organization.slug}/incidents`;
  const headers = {
    Authorization: `Bearer ${owner.token}`,
    'Content-Type': 'application/json',
  };
  const empty = await page(`/${organization.slug}/incidents`, owner.cookie());
  assert.equal(empty.status, 200);
  assert.match(await empty.text(), /Create incident/);
  const response = await fetch(base, {
    method: 'POST',
    headers,
    body: JSON.stringify({ title: 'Platform integration incident', severity: 'SEV2' }),
  });
  assert.equal(response.status, 201);
  const incident = await response.json();
  const catalog = await page(`/${organization.slug}/incidents`, owner.cookie());
  assert.equal(catalog.status, 200);
  assert.match(await catalog.text(), /Platform integration incident/);
  const details = await page(`/${organization.slug}/incidents/${incident.id}`, owner.cookie());
  assert.equal(details.status, 200);
  const html = await details.text();
  assert.match(html, /Activity timeline/);
  assert.match(html, /Update incident/);
  assert.match(html, /Platform integration incident/);
  const note = await fetch(`${base}/${incident.id}/notes`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ message: 'Service restored in test environment' }),
  });
  assert.equal(note.status, 201);
  const refreshed = await page(`/${organization.slug}/incidents/${incident.id}`, owner.cookie());
  assert.match(await refreshed.text(), /Service restored in test environment/);
  assert.match(
    await (await page(`/${organization.slug}/incidents`, outsider.cookie())).text(),
    /Workspace unavailable/,
  );
  assert.match(
    await (await page(`/${organization.slug}/incidents/${incident.id}`, outsider.cookie())).text(),
    /Workspace unavailable/,
  );
});
