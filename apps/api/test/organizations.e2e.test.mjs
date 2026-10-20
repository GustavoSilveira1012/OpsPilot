import 'reflect-metadata';
import assert from 'node:assert/strict';
import { generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';
import { NestFactory } from '@nestjs/core';
import pg from 'pg';
import { AppModule } from '../dist/app.module.js';
import { configureApp } from '../dist/app.setup.js';
import { PrismaService } from '../dist/prisma/prisma.service.js';

assert.ok(
  process.env.TEST_DATABASE_URL,
  'Set TEST_DATABASE_URL to an isolated, migrated test database.',
);
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const otherKey = generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey;
const jwk = {
  ...publicKey.export({ format: 'jwk' }),
  kid: 'auth-test-key',
  alg: 'ES256',
  use: 'sig',
};
const authServer = createServer((request, response) => {
  if (request.url === '/auth/v1/.well-known/jwks.json') {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ keys: [jwk] }));
  } else {
    response.writeHead(401);
    response.end('{}');
  }
});
let authUrl;
let apiUrl;
let app;
let prisma;
const ownerId = randomUUID();
const outsiderId = randomUUID();
const slug = `acme-${randomUUID().slice(0, 8)}`;
let organization;
let serviceId;
const sessions = new Map();

function token(userId, overrides = {}, key = privateKey) {
  if (!sessions.has(userId)) sessions.set(userId, randomUUID());
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(
    JSON.stringify({ alg: 'ES256', kid: 'auth-test-key', typ: 'JWT' }),
  ).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: userId,
      session_id: sessions.get(userId),
      email: `${userId}@example.test`,
      aud: 'authenticated',
      role: 'authenticated',
      iss: `${authUrl}/auth/v1`,
      exp: now + 300,
      iat: now,
      is_anonymous: false,
      ...overrides,
    }),
  ).toString('base64url');
  const input = `${header}.${payload}`;
  return `${input}.${sign('sha256', Buffer.from(input), { key, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
}

function request(method, path, bearer, body) {
  return fetch(`${apiUrl}${path}`, {
    method,
    headers: {
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

before(async () => {
  await new Promise((resolve) => authServer.listen(0, '127.0.0.1', resolve));
  authUrl = `http://127.0.0.1:${authServer.address().port}`;
  process.env.SUPABASE_URL = authUrl;
  process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_integration_test';
  app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  configureApp(app);
  await app.listen(0, '127.0.0.1');
  apiUrl = `${await app.getUrl()}/api/v1`;
  prisma = app.get(PrismaService);
});

after(async () => {
  if (app) await app.close();
  await new Promise((resolve) => authServer.close(resolve));
});

test('health remains public; organization endpoints reject missing or malformed tokens', async () => {
  assert.equal((await request('GET', '/health')).status, 200);
  assert.equal((await request('GET', '/organizations')).status, 401);
  assert.equal((await request('GET', '/organizations', 'invalid.jwt.value')).status, 401);
});

test('JWT signatures, expiry, issuer, audience and user role are verified', async () => {
  for (const bearer of [
    token(ownerId, {}, otherKey),
    token(ownerId, { exp: 1 }),
    token(ownerId, { exp: undefined }),
    token(ownerId, { iss: 'https://untrusted.example/auth/v1' }),
    token(ownerId, { aud: 'another-api' }),
    token(ownerId, { nbf: Math.floor(Date.now() / 1000) + 3600 }),
    token(ownerId, { role: 'service_role' }),
    token(ownerId, { is_anonymous: true }),
    token(ownerId, { session_id: null }),
    token(ownerId, { session_id: 'not-a-session-uuid' }),
    token('not-a-user-uuid'),
  ])
    assert.equal((await request('GET', '/organizations', bearer)).status, 401);
  assert.deepEqual(await (await request('GET', '/organizations', token(ownerId))).json(), []);
});

test('organization fields are validated and ownership cannot be supplied by the caller', async () => {
  for (const body of [
    { name: 'A', slug: 'valid-slug' },
    { name: 'Acme', slug: '../another' },
    { name: 'Acme', slug: 'login' },
    { name: 'Acme', slug: '-bad-slug' },
    { name: 'Acme', slug: 'valid-slug', userId: outsiderId, role: 'OWNER' },
  ])
    assert.equal((await request('POST', '/organizations', token(ownerId), body)).status, 400);
});

test('onboarding atomically creates the organization, verified profile and active owner membership', async () => {
  const response = await request('POST', '/organizations', token(ownerId), {
    name: ' Acme Engineering ',
    slug,
  });
  assert.equal(response.status, 201);
  assert.match(response.headers.get('cache-control'), /no-store/);
  organization = await response.json();
  assert.deepEqual(Object.keys(organization).sort(), ['id', 'name', 'slug']);
  assert.equal(organization.name, 'Acme Engineering');
  const membership = await prisma.membership.findUnique({
    where: { organizationId_userId: { organizationId: organization.id, userId: ownerId } },
  });
  assert.equal(membership.status, 'ACTIVE');
  assert.equal(membership.role, 'OWNER');
  assert.ok(membership.joinedAt);
  assert.equal(
    (await prisma.user.findUnique({ where: { id: ownerId } })).email,
    `${ownerId}@example.test`,
  );
  assert.deepEqual(
    await (await request('GET', `/organizations/${slug}/membership`, token(ownerId))).json(),
    { organization, role: 'OWNER' },
  );
});

test('duplicate slugs return 409 and the transaction leaves no orphan user', async () => {
  const response = await request('POST', '/organizations', token(outsiderId), {
    name: 'Another workspace',
    slug,
  });
  assert.equal(response.status, 409);
  assert.equal(await prisma.user.findUnique({ where: { id: outsiderId } }), null);
});

test('service catalog lists active services and owners can create them', async () => {
  const serviceSlug = `payments-${randomUUID().slice(0, 8)}`;
  const payload = {
    name: ' Payment API ',
    slug: serviceSlug,
    description: ' Handles payment processing. ',
    tier: 'TIER_1',
    runbookUrl: 'https://docs.example.test/payments',
  };
  const response = await request(
    'POST',
    `/organizations/${slug}/services`,
    token(ownerId),
    payload,
  );
  assert.equal(response.status, 201);
  assert.match(response.headers.get('cache-control'), /no-store/);
  const service = await response.json();
  assert.deepEqual(Object.keys(service).sort(), [
    'createdAt',
    'description',
    'id',
    'name',
    'runbookUrl',
    'slug',
    'status',
    'tier',
    'updatedAt',
  ]);
  serviceId = service.id;
  assert.equal(service.name, 'Payment API');
  assert.equal(service.description, 'Handles payment processing.');
  assert.equal(service.tier, 'TIER_1');
  assert.equal(service.status, 'OPERATIONAL');
  assert.equal(service.runbookUrl, payload.runbookUrl);

  const list = await request('GET', `/organizations/${slug}/services`, token(ownerId));
  assert.equal(list.status, 200);
  assert.match(list.headers.get('cache-control'), /no-store/);
  assert.deepEqual(await list.json(), [service]);

  assert.equal(
    (
      await request('POST', `/organizations/${slug}/services`, token(outsiderId), {
        ...payload,
        slug: `${serviceSlug}-outsider`,
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await request('POST', `/organizations/${slug}/services`, token(ownerId), {
        ...payload,
      })
    ).status,
    409,
  );
});

test('owners and admins can read and update organization services', async () => {
  const adminId = randomUUID();
  const memberId = randomUUID();
  await prisma.user.create({ data: { id: adminId, email: `${adminId}@example.test` } });
  await prisma.user.create({ data: { id: memberId, email: `${memberId}@example.test` } });
  await prisma.membership.create({
    data: {
      userId: adminId,
      organizationId: organization.id,
      status: 'ACTIVE',
      role: 'ADMIN',
      joinedAt: new Date(),
    },
  });
  await prisma.membership.create({
    data: {
      userId: memberId,
      organizationId: organization.id,
      status: 'ACTIVE',
      role: 'MEMBER',
      joinedAt: new Date(),
    },
  });

  const memberRead = await request(
    'GET',
    `/organizations/${slug}/services/${serviceId}`,
    token(memberId),
  );
  assert.equal(memberRead.status, 200);
  assert.equal((await memberRead.json()).id, serviceId);

  const adminUpdate = await request(
    'PATCH',
    `/organizations/${slug}/services/${serviceId}`,
    token(adminId),
    { description: 'Edited by admin', tier: 'TIER_0', status: 'DEGRADED' },
  );
  assert.equal(adminUpdate.status, 200);
  const adminUpdatedService = await adminUpdate.json();
  assert.equal(adminUpdatedService.description, 'Edited by admin');
  assert.equal(adminUpdatedService.tier, 'TIER_0');
  assert.equal(adminUpdatedService.status, 'DEGRADED');

  const ownerUpdate = await request(
    'PATCH',
    `/organizations/${slug}/services/${serviceId}`,
    token(ownerId),
    { name: 'Payment API updated' },
  );
  assert.equal(ownerUpdate.status, 200);
  const ownerUpdatedService = await ownerUpdate.json();
  assert.equal(ownerUpdatedService.name, 'Payment API updated');
  assert.equal(ownerUpdatedService.description, 'Edited by admin');
  assert.equal(ownerUpdatedService.tier, 'TIER_0');
  assert.equal(ownerUpdatedService.status, 'DEGRADED');
});

test('service IDs and update payloads are validated', async () => {
  for (const method of ['GET', 'PATCH', 'DELETE']) {
    const response = await request(
      method,
      `/organizations/${slug}/services/not-a-uuid`,
      token(ownerId),
      method === 'PATCH' ? { name: 'Valid service name' } : undefined,
    );
    assert.equal(response.status, 400);
  }

  for (const payload of [
    {},
    { name: 'A' },
    { tier: 'TIER_9' },
    { status: 'UNKNOWN' },
    { runbookUrl: 'not a URL' },
    { slug: 'cannot-change-the-slug' },
  ]) {
    const response = await request(
      'PATCH',
      `/organizations/${slug}/services/${serviceId}`,
      token(ownerId),
      payload,
    );
    assert.equal(
      response.status,
      400,
      `Expected invalid update payload to be rejected: ${JSON.stringify(payload)}`,
    );
  }
});

test('users in another organization cannot read or modify a service', async () => {
  const tenantOwnerId = randomUUID();
  const tenantSlug = `other-${randomUUID().slice(0, 8)}`;
  const createdOrganization = await request('POST', '/organizations', token(tenantOwnerId), {
    name: 'Another workspace',
    slug: tenantSlug,
  });
  assert.equal(createdOrganization.status, 201);

  const catalog = await request(
    'GET',
    `/organizations/${tenantSlug}/services`,
    token(tenantOwnerId),
  );
  assert.equal(catalog.status, 200);
  assert.deepEqual(await catalog.json(), []);

  for (const [method, body] of [
    ['GET', undefined],
    ['PATCH', { name: 'Cross-tenant edit' }],
    ['DELETE', undefined],
  ]) {
    const response = await request(
      method,
      `/organizations/${tenantSlug}/services/${serviceId}`,
      token(tenantOwnerId),
      body,
    );
    assert.equal(response.status, 404);
  }

  const unchanged = await prisma.service.findUnique({ where: { id: serviceId } });
  assert.equal(unchanged.name, 'Payment API updated');
  assert.equal(unchanged.archivedAt, null);
});

test('service creation validates input and only organization admins can create services', async () => {
  for (const body of [
    { name: 'A', slug: 'valid-service' },
    { name: 'Payment API', slug: '../invalid' },
    { name: 'Payment API', slug: 'bad-service', tier: 'TIER_9' },
    { name: 'Payment API', slug: 'bad-service', runbookUrl: 'not a URL' },
    { name: 'Payment API', slug: 'valid-service', organizationId: organization.id },
  ]) {
    assert.equal(
      (await request('POST', `/organizations/${slug}/services`, token(ownerId), body)).status,
      400,
    );
  }
});

test('competing workspace creation preserves uniqueness and rolls back the losing profile', async () => {
  const ids = [randomUUID(), randomUUID()];
  const concurrentSlug = `race-${randomUUID().slice(0, 8)}`;
  const responses = await Promise.all(
    ids.map((id) =>
      request('POST', '/organizations', token(id), {
        name: 'Concurrent workspace',
        slug: concurrentSlug,
      }),
    ),
  );
  assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409]);
  assert.equal(await prisma.organization.count({ where: { slug: concurrentSlug } }), 1);
  assert.equal(await prisma.user.count({ where: { id: { in: ids } } }), 1);
});

test('other tenants and INVITED, SUSPENDED or REMOVED memberships cannot read the workspace', async () => {
  assert.equal(
    (await request('GET', `/organizations/${slug}/membership`, token(outsiderId))).status,
    404,
  );
  await prisma.user.create({ data: { id: outsiderId } });
  await prisma.membership.create({
    data: {
      userId: outsiderId,
      organizationId: organization.id,
      status: 'INVITED',
      role: 'MEMBER',
    },
  });
  for (const status of ['INVITED', 'SUSPENDED', 'REMOVED']) {
    await prisma.membership.update({
      where: { organizationId_userId: { userId: outsiderId, organizationId: organization.id } },
      data: { status },
    });
    assert.equal(
      (await request('GET', `/organizations/${slug}/membership`, token(outsiderId))).status,
      404,
    );
    assert.deepEqual(await (await request('GET', '/organizations', token(outsiderId))).json(), []);
  }
  await prisma.membership.update({
    where: { organizationId_userId: { userId: outsiderId, organizationId: organization.id } },
    data: { status: 'ACTIVE' },
  });
  const response = await request('GET', `/organizations/${slug}/membership`, token(outsiderId));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).role, 'MEMBER');
  const services = await request('GET', `/organizations/${slug}/services`, token(outsiderId));
  assert.equal(services.status, 200);
  assert.equal((await services.json()).length, 1);
  assert.equal(
    (
      await request('POST', `/organizations/${slug}/services`, token(outsiderId), {
        name: 'Member service',
        slug: `member-${randomUUID().slice(0, 8)}`,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request('PATCH', `/organizations/${slug}/services/${serviceId}`, token(outsiderId), {
        name: 'Member edit',
      })
    ).status,
    403,
  );
  assert.equal(
    (await request('DELETE', `/organizations/${slug}/services/${serviceId}`, token(outsiderId)))
      .status,
    403,
  );
});

test('archiving hides a service but preserves its incident history', async () => {
  const incident = await prisma.incident.create({
    data: {
      organizationId: organization.id,
      number: 1,
      title: 'Incident retained after service archive',
      serviceId,
      createdByUserId: ownerId,
    },
  });

  const response = await request(
    'DELETE',
    `/organizations/${slug}/services/${serviceId}`,
    token(ownerId),
  );
  assert.equal(response.status, 204);
  assert.equal(await response.text(), '');

  const archivedService = await prisma.service.findUnique({ where: { id: serviceId } });
  assert.ok(archivedService.archivedAt);
  const catalog = await request('GET', `/organizations/${slug}/services`, token(ownerId));
  assert.equal(catalog.status, 200);
  assert.deepEqual(await catalog.json(), []);
  assert.equal(
    (await request('GET', `/organizations/${slug}/services/${serviceId}`, token(ownerId))).status,
    404,
  );

  const retainedIncident = await prisma.incident.findUnique({
    where: { organizationId_number: { organizationId: organization.id, number: incident.number } },
  });
  assert.ok(retainedIncident);
  assert.equal(retainedIncident.serviceId, serviceId);
});

test('archived workspaces and deactivated users cannot access tenant data', async () => {
  await prisma.organization.update({
    where: { id: organization.id },
    data: { archivedAt: new Date() },
  });
  assert.equal(
    (await request('GET', `/organizations/${slug}/membership`, token(ownerId))).status,
    404,
  );
  await prisma.organization.update({ where: { id: organization.id }, data: { archivedAt: null } });
  await prisma.user.update({ where: { id: ownerId }, data: { deactivatedAt: new Date() } });
  assert.equal(
    (await request('GET', `/organizations/${slug}/membership`, token(ownerId))).status,
    404,
  );
  assert.equal(
    (
      await request('POST', '/organizations', token(ownerId), {
        name: 'Blocked',
        slug: `blocked-${randomUUID().slice(0, 8)}`,
      })
    ).status,
    403,
  );
});

test('RLS denies direct table access even when an unprivileged Data API role has grants', async () => {
  const client = new pg.Client({ connectionString: process.env.TEST_DATABASE_URL });
  await client.connect();
  const role = `opspilot_rls_${randomUUID().replaceAll('-', '')}`;
  try {
    await client.query('BEGIN');
    await client.query(`CREATE ROLE "${role}" NOLOGIN`);
    await client.query(`GRANT USAGE ON SCHEMA public TO "${role}"`);
    await client.query(`GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA public TO "${role}"`);
    await client.query(`SET LOCAL ROLE "${role}"`);
    assert.deepEqual((await client.query('SELECT id FROM organizations')).rows, []);
    assert.deepEqual((await client.query('SELECT session_id FROM revoked_sessions')).rows, []);
    await assert.rejects(
      client.query('INSERT INTO users (id, updated_at) VALUES ($1, now())', [randomUUID()]),
      { code: '42501' },
    );
  } finally {
    await client.query('ROLLBACK');
    await client.end();
  }
});

test('logout denies replayed and refreshed access tokens while a new sign-in remains valid', async () => {
  const bearer = token(outsiderId);
  assert.equal((await request('GET', '/organizations', bearer)).status, 200);
  assert.equal((await request('POST', '/auth/logout', bearer)).status, 204);
  assert.equal((await request('GET', '/organizations', bearer)).status, 401);
  assert.equal((await request('GET', `/organizations/${slug}/membership`, bearer)).status, 401);
  assert.equal((await request('POST', '/auth/logout', bearer)).status, 401);
  const refreshed = token(outsiderId, { exp: Math.floor(Date.now() / 1000) + 3600 });
  assert.equal((await request('GET', '/organizations', refreshed)).status, 401);
  const newSignIn = token(outsiderId, { session_id: randomUUID() });
  assert.equal((await request('GET', `/organizations/${slug}/membership`, newSignIn)).status, 200);
});

test('a user without an application profile can revoke their session before onboarding', async () => {
  const id = randomUUID();
  const bearer = token(id);
  assert.equal((await request('POST', '/auth/logout')).status, 401);
  assert.equal((await request('POST', '/auth/logout', bearer)).status, 204);
  assert.equal(await prisma.user.findUnique({ where: { id } }), null);
  assert.equal((await request('GET', '/organizations', bearer)).status, 401);
});
