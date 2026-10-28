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

async function ownershipFixture() {
  const ids = {
    owner: randomUUID(),
    admin: randomUUID(),
    member: randomUUID(),
    foreign: randomUUID(),
  };
  const orgSlug = `ownership-${randomUUID().slice(0, 8)}`;
  const foreignSlug = `foreign-${randomUUID().slice(0, 8)}`;
  const created = await request('POST', '/organizations', token(ids.owner), {
    name: 'Ownership workspace',
    slug: orgSlug,
  });
  assert.equal(created.status, 201);
  const org = await created.json();
  for (const [id, role, displayName] of [
    [ids.admin, 'ADMIN', 'Active Admin'],
    [ids.member, 'MEMBER', 'Active Member'],
  ]) {
    await prisma.user.create({ data: { id, email: `${id}@example.test`, displayName } });
    await prisma.membership.create({
      data: { userId: id, organizationId: org.id, role, status: 'ACTIVE', joinedAt: new Date() },
    });
  }
  const foreign = await request('POST', '/organizations', token(ids.foreign), {
    name: 'Other workspace',
    slug: foreignSlug,
  });
  assert.equal(foreign.status, 201);
  const createdService = await request(
    'POST',
    `/organizations/${orgSlug}/services`,
    token(ids.owner),
    { name: 'Ownership service', slug: 'ownership-service' },
  );
  assert.equal(createdService.status, 201);
  const service = await createdService.json();
  const base = `/organizations/${orgSlug}/services/${service.id}`;
  return {
    ids,
    org,
    orgSlug,
    foreignSlug,
    service,
    base,
    owners: `${base}/owners`,
    members: `/organizations/${orgSlug}/members`,
  };
}

test('ownership and member-directory routes require authentication and validate UUIDs', async () => {
  const f = await ownershipFixture();
  for (const [method, path] of [
    ['GET', f.members],
    ['GET', f.owners],
    ['PUT', `${f.owners}/${f.ids.member}`],
    ['DELETE', `${f.owners}/${f.ids.member}`],
  ])
    assert.equal((await request(method, path)).status, 401);
  for (const method of ['PUT', 'DELETE'])
    assert.equal((await request(method, `${f.owners}/invalid`, token(f.ids.owner))).status, 400);
  assert.equal(
    (
      await request(
        'GET',
        `/organizations/${f.orgSlug}/services/invalid/owners`,
        token(f.ids.owner),
      )
    ).status,
    400,
  );
});

test('owner selector directory includes only real active members of the authorized organization', async () => {
  const f = await ownershipFixture();
  const excluded = [];
  for (const status of ['INVITED', 'SUSPENDED', 'REMOVED', 'ACTIVE']) {
    const id = randomUUID();
    excluded.push(id);
    await prisma.user.create({
      data: { id, deactivatedAt: status === 'ACTIVE' ? new Date() : null },
    });
    await prisma.membership.create({
      data: { userId: id, organizationId: f.org.id, role: 'MEMBER', status },
    });
  }
  for (const actor of [f.ids.owner, f.ids.admin]) {
    const response = await request('GET', f.members, token(actor));
    assert.equal(response.status, 200);
    assert.match(response.headers.get('cache-control'), /no-store/);
    const members = await response.json();
    assert.deepEqual(
      members.map((member) => member.userId).sort(),
      [f.ids.owner, f.ids.admin, f.ids.member].sort(),
    );
    assert.deepEqual(Object.keys(members[0]).sort(), ['displayName', 'email', 'role', 'userId']);
    assert.ok(
      !members.some(
        (member) => excluded.includes(member.userId) || member.userId === f.ids.foreign,
      ),
    );
  }
  assert.equal((await request('GET', f.members, token(f.ids.member))).status, 403);
  assert.equal((await request('GET', f.members, token(f.ids.foreign))).status, 404);
});

test('owners/admins assign and remove owners idempotently; regular members are read-only', async () => {
  const f = await ownershipFixture();
  const target = `${f.owners}/${f.ids.member}`;
  const repeated = await Promise.all([
    request('PUT', target, token(f.ids.owner)),
    request('PUT', target, token(f.ids.admin)),
  ]);
  assert.deepEqual(
    repeated.map((response) => response.status),
    [204, 204],
  );
  assert.equal(
    await prisma.serviceOwnership.count({
      where: { serviceId: f.service.id, userId: f.ids.member },
    }),
    1,
  );
  const response = await request('GET', f.owners, token(f.ids.member));
  assert.equal(response.status, 200);
  const owners = await response.json();
  assert.equal(owners.length, 1);
  assert.equal(owners[0].displayName, 'Active Member');
  assert.equal(owners[0].role, 'MEMBER');
  assert.ok(Number.isFinite(Date.parse(owners[0].assignedAt)));
  assert.deepEqual(Object.keys(owners[0]).sort(), [
    'assignedAt',
    'displayName',
    'email',
    'role',
    'userId',
  ]);
  for (const method of ['PUT', 'DELETE'])
    assert.equal((await request(method, target, token(f.ids.member))).status, 403);
  for (const actor of [f.ids.admin, f.ids.owner])
    assert.equal((await request('DELETE', target, token(actor))).status, 204);
  assert.deepEqual(await (await request('GET', f.owners, token(f.ids.owner))).json(), []);
});

test('assignment rejects inactive, deactivated, missing and foreign members without writing ownership', async () => {
  const f = await ownershipFixture();
  for (const status of ['INVITED', 'SUSPENDED', 'REMOVED', 'ACTIVE']) {
    const id = randomUUID();
    await prisma.user.create({
      data: { id, deactivatedAt: status === 'ACTIVE' ? new Date() : null },
    });
    await prisma.membership.create({
      data: { userId: id, organizationId: f.org.id, role: 'MEMBER', status },
    });
    assert.equal((await request('PUT', `${f.owners}/${id}`, token(f.ids.owner))).status, 404);
  }
  for (const id of [f.ids.foreign, randomUUID()])
    assert.equal((await request('PUT', `${f.owners}/${id}`, token(f.ids.owner))).status, 404);
  assert.equal(await prisma.serviceOwnership.count({ where: { serviceId: f.service.id } }), 0);
});

test('a valid manager cannot read or mutate service ownership through a different tenant slug', async () => {
  const f = await ownershipFixture();
  await request('PUT', `${f.owners}/${f.ids.member}`, token(f.ids.owner));
  const foreignBase = `/organizations/${f.foreignSlug}/services/${f.service.id}/owners`;
  for (const base of [foreignBase, f.owners]) {
    for (const [method, path] of [
      ['GET', base],
      ['PUT', `${base}/${f.ids.foreign}`],
      ['DELETE', `${base}/${f.ids.member}`],
    ])
      assert.equal((await request(method, path, token(f.ids.foreign))).status, 404);
  }
  assert.equal(
    await prisma.serviceOwnership.count({
      where: { serviceId: f.service.id, userId: f.ids.member },
    }),
    1,
  );
});

test('inactive callers, deactivated profiles and archived organizations lose ownership access', async () => {
  const f = await ownershipFixture();
  for (const status of ['INVITED', 'SUSPENDED', 'REMOVED']) {
    await prisma.membership.update({
      where: { organizationId_userId: { organizationId: f.org.id, userId: f.ids.admin } },
      data: { status },
    });
    for (const [method, path] of [
      ['GET', f.members],
      ['GET', f.owners],
      ['PUT', `${f.owners}/${f.ids.member}`],
      ['DELETE', `${f.owners}/${f.ids.member}`],
    ])
      assert.equal((await request(method, path, token(f.ids.admin))).status, 404);
  }
  await prisma.membership.update({
    where: { organizationId_userId: { organizationId: f.org.id, userId: f.ids.admin } },
    data: { status: 'ACTIVE' },
  });
  await prisma.user.update({ where: { id: f.ids.admin }, data: { deactivatedAt: new Date() } });
  assert.equal((await request('GET', f.owners, token(f.ids.admin))).status, 404);
  await prisma.organization.update({ where: { id: f.org.id }, data: { archivedAt: new Date() } });
  assert.equal((await request('GET', f.members, token(f.ids.owner))).status, 404);
  assert.equal(
    (await request('PUT', `${f.owners}/${f.ids.member}`, token(f.ids.owner))).status,
    404,
  );
});

test('inactive assigned owners are hidden while their historical rows remain removable', async () => {
  const f = await ownershipFixture();
  const target = `${f.owners}/${f.ids.member}`;
  assert.equal((await request('PUT', target, token(f.ids.owner))).status, 204);
  for (const status of ['INVITED', 'SUSPENDED', 'REMOVED']) {
    await prisma.membership.update({
      where: { organizationId_userId: { organizationId: f.org.id, userId: f.ids.member } },
      data: { status },
    });
    assert.deepEqual(await (await request('GET', f.owners, token(f.ids.owner))).json(), []);
    assert.equal(await prisma.serviceOwnership.count({ where: { serviceId: f.service.id } }), 1);
  }
  await prisma.membership.update({
    where: { organizationId_userId: { organizationId: f.org.id, userId: f.ids.member } },
    data: { status: 'ACTIVE' },
  });
  await prisma.user.update({ where: { id: f.ids.member }, data: { deactivatedAt: new Date() } });
  assert.deepEqual(await (await request('GET', f.owners, token(f.ids.owner))).json(), []);
  assert.equal((await request('DELETE', target, token(f.ids.admin))).status, 204);
});

test('editing validates nullable fields, protocol restrictions and immutable tenant/slug fields', async () => {
  const f = await ownershipFixture();
  for (const body of [
    { name: 'Valid name', slug: 'invalid-tier', tier: null },
    { name: 'Valid name', slug: 'ftp-link', runbookUrl: 'ftp://example.com/runbook' },
  ])
    assert.equal(
      (await request('POST', `/organizations/${f.orgSlug}/services`, token(f.ids.owner), body))
        .status,
      400,
    );
  for (const body of [
    { name: null },
    { tier: null },
    { status: null },
    { runbookUrl: 'javascript:alert(1)' },
    { runbookUrl: 'ftp://example.com/runbook' },
    { organizationId: f.org.id },
    { slug: 'new-slug' },
  ])
    assert.equal((await request('PATCH', f.base, token(f.ids.owner), body)).status, 400);
  const edited = await request('PATCH', f.base, token(f.ids.admin), {
    name: 'Updated ownership service',
    description: null,
    runbookUrl: null,
    status: 'MAINTENANCE',
  });
  assert.equal(edited.status, 200);
  assert.equal((await edited.json()).status, 'MAINTENANCE');
  assert.equal(
    (await request('PATCH', f.base, token(f.ids.member), { name: 'Unauthorized edit' })).status,
    403,
  );
});

test('archiving closes owner endpoints while preserving assignments and forbidding member archival', async () => {
  const f = await ownershipFixture();
  assert.equal(
    (await request('PUT', `${f.owners}/${f.ids.member}`, token(f.ids.owner))).status,
    204,
  );
  assert.equal((await request('DELETE', f.base, token(f.ids.member))).status, 403);
  assert.equal((await request('DELETE', f.base, token(f.ids.admin))).status, 204);
  for (const [method, path] of [
    ['GET', f.base],
    ['GET', f.owners],
    ['PUT', `${f.owners}/${f.ids.member}`],
    ['DELETE', `${f.owners}/${f.ids.member}`],
    ['DELETE', f.base],
  ])
    assert.equal((await request(method, path, token(f.ids.owner))).status, 404);
  assert.equal(await prisma.serviceOwnership.count({ where: { serviceId: f.service.id } }), 1);
  assert.deepEqual(
    await (await request('GET', `/organizations/${f.orgSlug}/services`, token(f.ids.owner))).json(),
    [],
  );
});

test('concurrent ownership assignment and archiving serialize on the service row', async () => {
  const f = await ownershipFixture();
  const [assigned, archived] = await Promise.all([
    request('PUT', `${f.owners}/${f.ids.member}`, token(f.ids.owner)),
    request('DELETE', f.base, token(f.ids.admin)),
  ]);
  assert.equal(archived.status, 204);
  assert.ok([204, 404].includes(assigned.status));
  assert.equal(
    (await request('PUT', `${f.owners}/${f.ids.admin}`, token(f.ids.owner))).status,
    404,
  );
  assert.ok((await prisma.service.findUnique({ where: { id: f.service.id } })).archivedAt);
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

  const refreshedService = await request(
    'GET',
    `/organizations/${slug}/services/${serviceId}`,
    token(ownerId),
  );
  assert.equal(refreshedService.status, 200);
  const persistedService = await refreshedService.json();
  assert.equal(persistedService.name, 'Payment API updated');
  assert.equal(persistedService.description, 'Edited by admin');
  assert.equal(persistedService.tier, 'TIER_0');
  assert.equal(persistedService.status, 'DEGRADED');
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
