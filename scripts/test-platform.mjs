import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { createAuthFixture } from './auth-test-fixture.mjs';

assert.ok(
  process.env.TEST_DATABASE_URL,
  'Set TEST_DATABASE_URL to an isolated, migrated test database.',
);
const root = fileURLToPath(new URL('../', import.meta.url));
const webRequire = createRequire(new URL('../apps/web/package.json', import.meta.url));
const authUrl = 'http://127.0.0.1:3155';
const webUrl = 'http://127.0.0.1:3100';
const apiUrl = 'http://127.0.0.1:3101/api/v1';
const children = [];
let logs = '';
let fixture;
const env = {
  ...process.env,
  DATABASE_URL: process.env.TEST_DATABASE_URL,
  SUPABASE_URL: authUrl,
  PORT: '3101',
  CORS_ORIGINS: webUrl,
  NEXT_PUBLIC_SUPABASE_URL: authUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_platform_test',
  NEXT_PUBLIC_API_BASE_URL: apiUrl,
  TEST_WEB_URL: webUrl,
  TEST_API_URL: apiUrl,
  TEST_AUTH_URL: authUrl,
  NEXT_TELEMETRY_DISABLED: '1',
};
function child(args, cwd) {
  const process = spawn(globalThis.process.execPath, args, {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push(process);
  for (const stream of [process.stdout, process.stderr])
    stream.on('data', (data) => {
      logs = (logs + data).slice(-12_000);
    });
  return process;
}
async function ready(url, process) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (process.exitCode !== null)
      throw new Error(`Test server exited with code ${process.exitCode}.`);
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(1500) })).ok) return;
    } catch {
      /* Startup in progress. */
    }
    await delay(250);
  }
  throw new Error(`Test server did not become ready: ${url}`);
}
try {
  for (const port of [3100, 3101, 3155])
    await new Promise((resolve, reject) => {
      const probe = net.createServer();
      probe.once('error', () =>
        reject(new Error(`Test port ${port} is in use. Stop your earlier test preview first.`)),
      );
      probe.listen(port, '127.0.0.1', () => probe.close(resolve));
    });
  fixture = createAuthFixture(authUrl, webUrl);
  await new Promise((resolve) => fixture.listen(3155, '127.0.0.1', resolve));
  const api = child(['dist/main.js'], `${root}/apps/api`);
  const web = child(
    [webRequire.resolve('next/dist/bin/next'), 'dev', '--hostname', '127.0.0.1', '--port', '3100'],
    `${root}/apps/web`,
  );
  await Promise.all([ready(`${apiUrl}/health`, api), ready(`${webUrl}/login`, web)]);
  const test = spawn(process.execPath, ['--test', 'test/session.e2e.test.mjs'], {
    cwd: `${root}/apps/web`,
    env,
    stdio: 'inherit',
  });
  children.push(test);
  const code = await new Promise((resolve, reject) => {
    test.once('error', reject);
    test.once('exit', resolve);
  });
  if (code !== 0) throw new Error(`Platform integration tests failed (${code}).`);
} catch (error) {
  console.error(logs);
  console.error(error);
  process.exitCode = 1;
} finally {
  for (const process of children.reverse()) if (process.exitCode === null) process.kill();
  if (fixture) {
    fixture.closeAllConnections();
    await new Promise((resolve) => fixture.close(resolve));
  }
}
