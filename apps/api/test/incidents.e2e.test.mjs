test('managers assign and remove incident responders', async () => {
  const f = await fixture();

  const created = await request('POST', f.base, f.owner, { title: 'Responder assignment test' });

  assert.equal(created.status, 201);

  const incident = await created.json();
  const base = `${f.base}/${incident.id}`;
  const target = `${base}/responders/${f.member}`;

  assert.equal((await request('PUT', target, f.member)).status, 403);

  assert.equal((await request('PUT', target, f.owner)).status, 204);

  // Idempotency: assigning twice creates no duplicate.
  assert.equal((await request('PUT', target, f.owner)).status, 204);

  const response = await request('GET', `${base}/responders`, f.member);

  assert.equal(response.status, 200);

  const responders = await response.json();
  assert.equal(responders.length, 1);
  assert.equal(responders[0].userId, f.member);

  assert.equal((await request('DELETE', target, f.owner)).status, 204);

  assert.equal((await request('DELETE', target, f.owner)).status, 204);

  const details = await (await request('GET', base, f.owner)).json();

  assert.deepEqual(
    details.timeline.map((event) => event.type),
    ['INCIDENT_CREATED', 'RESPONDER_ASSIGNED', 'RESPONDER_REMOVED'],
  );
});

test('incident service linking is tenant-scoped and audited', async () => {
  const f = await fixture();

  const created = await request('POST', f.base, f.owner, {
    title: 'Service linking test',
  });

  assert.equal(created.status, 201);

  const incident = await created.json();
  const url = `${f.base}/${incident.id}`;

  const linked = await request('PATCH', url, f.owner, {
    serviceId: f.service.id,
  });

  assert.equal(linked.status, 200);
  assert.equal((await linked.json()).serviceId, f.service.id);

  const invalid = await request('PATCH', url, f.owner, {
    serviceId: randomUUID(),
  });

  assert.equal(invalid.status, 404);

  const unlinked = await request('PATCH', url, f.owner, {
    serviceId: null,
  });

  assert.equal(unlinked.status, 200);
  assert.equal((await unlinked.json()).serviceId, null);

  const details = await (await request('GET', url, f.owner)).json();

  assert.deepEqual(
    details.timeline.map((event) => event.type),
    ['INCIDENT_CREATED', 'SERVICE_LINKED', 'SERVICE_UNLINKED'],
  );
});
