import 'reflect-metadata';
import assert from 'node:assert/strict';
import { generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import { createServer } from 'node:http';
import { after, before, test } from 'node:test';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../dist/app.module.js';
import { configureApp } from '../dist/app.setup.js';
import { PrismaService } from '../dist/prisma/prisma.service.js';

assert.ok(process.env.TEST_DATABASE_URL, 'Use an isolated migrated TEST_DATABASE_URL.');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const jwk = {
  ...publicKey.export({ format: 'jwk' }),
  kid: 'incident-test-key',
  alg: 'ES256',
  use: 'sig',
};
const authServer = createServer((request, response) => {
  if (request.url === '/auth/v1/.well-known/jwks.json') {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ keys: [jwk] }));
  } else {
    response.writeHead(404);
    response.end('{}');
  }
});
let authUrl, apiUrl, app, prisma;
const sessions = new Map();
function token(userId) {
  if (!sessions.has(userId)) sessions.set(userId, randomUUID());
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(
    JSON.stringify({ alg: 'ES256', kid: 'incident-test-key', typ: 'JWT' }),
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
    }),
  ).toString('base64url');
  const message = `${header}.${payload}`;
  return `${message}.${sign('sha256', Buffer.from(message), { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
}
function request(method, path, userId, body) {
  return fetch(`${apiUrl}${path}`, {
    method,
    headers: {
      ...(userId ? { Authorization: `Bearer ${token(userId)}` } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}
before(async () => {
  await new Promise((resolve) => authServer.listen(0, '127.0.0.1', resolve));
  authUrl = `http://127.0.0.1:${authServer.address().port}`;
  process.env.SUPABASE_URL = authUrl;
  process.env.SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_incident_test';
  app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  configureApp(app);
  await app.listen(0, '127.0.0.1');
  apiUrl = `${await app.getUrl()}/api/v1`;
  prisma = app.get(PrismaService);
});
after(async () => {
  if (app) await app.close();
  authServer.closeAllConnections();
  await new Promise((resolve) => authServer.close(resolve));
});
async function fixture() {
  const owner = randomUUID(),
    member = randomUUID(),
    outsider = randomUUID();
  const slug = `incident-${randomUUID().slice(0, 8)}`,
    foreignSlug = `foreign-${randomUUID().slice(0, 8)}`;
  const response = await request('POST', '/organizations', owner, { name: 'Incident test', slug });
  assert.equal(response.status, 201);
  const organization = await response.json();
  await prisma.user.create({ data: { id: member, email: `${member}@example.test` } });
  await prisma.membership.create({
    data: {
      organizationId: organization.id,
      userId: member,
      role: 'MEMBER',
      status: 'ACTIVE',
      joinedAt: new Date(),
    },
  });
  assert.equal(
    (await request('POST', '/organizations', outsider, { name: 'Foreign test', slug: foreignSlug }))
      .status,
    201,
  );
  const svc = await request('POST', `/organizations/${slug}/services`, owner, {
    name: 'Test API',
    slug: 'test-api',
  });
  assert.equal(svc.status, 201);
  const service = await svc.json();
  return {
    owner,
    member,
    outsider,
    slug,
    foreignSlug,
    organization,
    service,
    base: `/organizations/${slug}/incidents`,
  };
}
test('incident creation is atomic, numbered and produces an initial event', async () => {
  const f = await fixture();
  const created = await request('POST', f.base, f.owner, {
    title: 'Payment outage',
    severity: 'SEV1',
    serviceId: f.service.id,
  });
  assert.equal(created.status, 201);
  const incident = await created.json();
  assert.equal(incident.number, 1);
  assert.equal(incident.status, 'INVESTIGATING');
  assert.equal(incident.severity, 'SEV1');
  const details = await request('GET', `${f.base}/${incident.id}`, f.member);
  assert.equal(details.status, 200);
  const body = await details.json();
  assert.equal(body.timeline.length, 1);
  assert.equal(body.timeline[0].type, 'INCIDENT_CREATED');
  assert.equal(body.timeline[0].actorUserId, f.owner);
  assert.equal(
    (await prisma.organization.findUnique({ where: { id: f.organization.id } })).nextIncidentNumber,
    2,
  );
});
test('creation handles concurrent numbering and rejects invalid or foreign services', async () => {
  const f = await fixture();
  const failures = [
    { title: 'bad' },
    { title: 'A valid title', severity: 'SEV0' },
    { title: 'A valid title', serviceId: randomUUID() },
    { title: 'A valid title', number: 300 },
  ];
  for (const body of failures) {
    const response = await request('POST', f.base, f.owner, body);
    assert.ok([400, 404].includes(response.status));
  }
  const requests = await Promise.all(
    Array.from({ length: 5 }, (_, i) =>
      request('POST', f.base, f.owner, { title: `Failure number ${i}` }),
    ),
  );
  assert.deepEqual(
    requests.map((r) => r.status),
    [201, 201, 201, 201, 201],
  );
  const numbers = await Promise.all(requests.map(async (r) => (await r.json()).number));
  assert.deepEqual(
    numbers.sort((a, b) => a - b),
    [1, 2, 3, 4, 5],
  );
});
test('role authorization, tenant isolation and filters', async () => {
  const f = await fixture();
  assert.equal(
    (await request('POST', f.base, f.member, { title: 'Member cannot create' })).status,
    403,
  );
  assert.equal((await request('GET', f.base)).status, 401);
  const created = await request('POST', f.base, f.owner, {
    title: 'Filtering incident',
    severity: 'SEV2',
  });
  const incident = await created.json();
  const readList = await request('GET', f.base, f.member);
  assert.equal(readList.status, 200, await readList.text());
  const filteredList = await request('GET', `${f.base}?severity=SEV2&limit=1`, f.member);
  assert.equal(filteredList.status, 200, await filteredList.text());
  assert.equal((await request('GET', `${f.base}?limit=1000`, f.member)).status, 400);
  assert.equal((await request('GET', f.base, f.outsider)).status, 404);
  assert.equal((await request('GET', `${f.base}/${incident.id}`, f.outsider)).status, 404);
  assert.equal(
    (await request('GET', `/organizations/${f.foreignSlug}/incidents/${incident.id}`, f.outsider))
      .status,
    404,
  );
  assert.equal(
    (await request('PATCH', `${f.base}/${incident.id}`, f.outsider, { status: 'RESOLVED' })).status,
    404,
  );
});
test('lifecycle and notes preserve ordered history, enforce permissions and resolution', async () => {
  const f = await fixture();
  const created = await request('POST', f.base, f.owner, {
    title: 'Lifecycle incident',
    severity: 'SEV3',
  });
  const incident = await created.json(),
    url = `${f.base}/${incident.id}`;
  assert.equal((await request('PATCH', url, f.member, { status: 'RESOLVED' })).status, 403);
  assert.equal((await request('PATCH', url, f.owner, { status: null })).status, 400);
  assert.equal((await request('PATCH', url, f.owner, {})).status, 400);
  const update = await request('PATCH', url, f.owner, {
    status: 'RESOLVED',
    severity: 'SEV1',
    summary: 'Fixed by rollback',
  });
  assert.equal(update.status, 200);
  const resolved = await update.json();
  assert.ok(resolved.resolvedAt);
  assert.equal((await request('PATCH', url, f.owner, { status: 'MONITORING' })).status, 409);
  const note = await request('POST', `${url}/notes`, f.member, { message: 'Verified deployment' });
  assert.equal(note.status, 201);
  assert.equal((await note.json()).type, 'MESSAGE_ADDED');
  assert.equal((await request('POST', `${url}/notes`, f.member, { message: ' ' })).status, 400);
  const reopened = await request('PATCH', url, f.owner, { status: 'INVESTIGATING' });
  assert.equal(reopened.status, 200);
  assert.equal((await reopened.json()).resolvedAt, null);
  const detail = await (await request('GET', url, f.member)).json();
  assert.deepEqual(
    detail.timeline.map((e) => e.type).sort(),
    [
      'INCIDENT_CREATED',
      'STATUS_CHANGED',
      'SEVERITY_CHANGED',
      'DESCRIPTION_UPDATED',
      'MESSAGE_ADDED',
      'STATUS_CHANGED',
    ].sort(),
  );
  assert.equal((await request('PATCH', url, f.owner, { status: 'INVESTIGATING' })).status, 200);
  assert.equal((await (await request('GET', url, f.owner)).json()).timeline.length, 6);
});
test('inactive members cannot create or add timeline notes', async () => {
  const f = await fixture();
  const created = await request('POST', f.base, f.owner, { title: 'Access boundaries' });
  const incident = await created.json();
  await prisma.membership.update({
    where: { organizationId_userId: { organizationId: f.organization.id, userId: f.member } },
    data: { status: 'SUSPENDED' },
  });
  const deniedList = await request('GET', f.base, f.member);
  assert.equal(deniedList.status, 404, await deniedList.text());
  assert.equal(
    (
      await request('POST', `${f.base}/${incident.id}/notes`, f.member, {
        message: 'Access denied',
      })
    ).status,
    404,
  );
});

test('responder assignments are tenant-scoped, idempotent and audited', async () => {
  const f = await fixture();
  const created = await request('POST', f.base, f.owner, { title: 'Responder assignment case' });
  assert.equal(created.status, 201);
  const { id } = await created.json();
  const route = `${f.base}/${id}/responders`;
  const target = `${route}/${f.member}`;
  assert.equal((await request('PUT', target, f.member)).status, 403);
  assert.equal((await request('PUT', `${route}/${f.outsider}`, f.owner)).status, 404);
  assert.equal((await request('PUT', target, f.owner)).status, 204);
  assert.equal((await request('PUT', target, f.owner)).status, 204);
  const response = await request('GET', route, f.member);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).length, 1);
  assert.equal((await request('GET', route, f.outsider)).status, 404);
  assert.equal((await request('DELETE', target, f.owner)).status, 204);
  assert.equal((await request('DELETE', target, f.owner)).status, 204);
  const detail = await (await request('GET', `${f.base}/${id}`, f.owner)).json();
  assert.deepEqual(
    detail.timeline.map((x) => x.type),
    ['INCIDENT_CREATED', 'RESPONDER_ASSIGNED', 'RESPONDER_REMOVED'],
  );
});

test('linking and unlinking services validates tenant scope and appends ordered events', async () => {
  const f = await fixture();
  const created = await request('POST', f.base, f.owner, { title: 'Service reassignment case' });
  assert.equal(created.status, 201);
  const { id } = await created.json();
  const path = `${f.base}/${id}`;
  assert.equal((await request('PATCH', path, f.member, { serviceId: f.service.id })).status, 403);
  assert.equal((await request('PATCH', path, f.owner, { serviceId: randomUUID() })).status, 404);
  const linked = await request('PATCH', path, f.owner, { serviceId: f.service.id });
  assert.equal(linked.status, 200);
  assert.equal((await linked.json()).serviceId, f.service.id);
  const unlinked = await request('PATCH', path, f.owner, { serviceId: null });
  assert.equal(unlinked.status, 200);
  assert.equal((await unlinked.json()).serviceId, null);
  const timeline = (await (await request('GET', path, f.owner)).json()).timeline;
  assert.deepEqual(
    timeline.map((event) => event.type),
    ['INCIDENT_CREATED', 'SERVICE_LINKED', 'SERVICE_UNLINKED'],
  );
  const rows = await prisma.incidentEvent.findMany({
    where: { incidentId: id },
    orderBy: { sequence: 'asc' },
    select: { sequence: true },
  });
  assert.ok(rows.every((row, index) => index === 0 || row.sequence > rows[index - 1].sequence));
});

test('suspended responders cannot be newly assigned', async () => {
  const f = await fixture();
  const incidentResponse = await request('POST', f.base, f.owner, {
    title: 'Suspended responder validation',
  });
  const { id } = await incidentResponse.json();
  await prisma.membership.update({
    where: { organizationId_userId: { organizationId: f.organization.id, userId: f.member } },
    data: { status: 'SUSPENDED' },
  });
  assert.equal(
    (await request('PUT', `${f.base}/${id}/responders/${f.member}`, f.owner)).status,
    404,
  );
});
