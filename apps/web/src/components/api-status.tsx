'use client';

import { useEffect, useState } from 'react';
import type { HealthResponse } from '@opspilot/contracts';

type ConnectionState =
  | { status: 'checking' }
  | { status: 'connected'; checkedAt: string; health: HealthResponse }
  | { status: 'unavailable'; checkedAt: string };

function isHealthResponse(value: unknown): value is HealthResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return (
    'status' in value &&
    value.status === 'ok' &&
    'service' in value &&
    value.service === 'opspilot-api' &&
    'version' in value &&
    typeof value.version === 'string' &&
    'timestamp' in value &&
    typeof value.timestamp === 'string'
  );
}

export function ApiStatus() {
  const [connection, setConnection] = useState<ConnectionState>({ status: 'checking' });
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api/v1';

  useEffect(() => {
    const controller = new AbortController();
    let isCurrent = true;

    async function loadConnection(): Promise<void> {
      try {
        const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/health`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        const payload: unknown = await response.json();

        if (!response.ok || !isHealthResponse(payload)) {
          throw new Error('Health endpoint returned an unexpected response.');
        }

        if (isCurrent) {
          setConnection({
            status: 'connected',
            checkedAt: new Date().toISOString(),
            health: payload,
          });
        }
      } catch {
        if (isCurrent && !controller.signal.aborted) {
          setConnection({ status: 'unavailable', checkedAt: new Date().toISOString() });
        }
      }
    }

    void loadConnection();

    return () => {
      isCurrent = false;
      controller.abort();
    };
  }, [apiBaseUrl]);

  if (connection.status === 'checking') {
    return (
      <div aria-live="polite" className="connection-state">
        <span className="state-icon state-icon-pending" aria-hidden="true">
          …
        </span>
        <div>
          <p className="connection-title">Checking service</p>
          <p className="connection-detail">Waiting for the API health check.</p>
        </div>
      </div>
    );
  }

  if (connection.status === 'unavailable') {
    return (
      <div aria-live="polite" className="connection-state">
        <span className="state-icon state-icon-down" aria-hidden="true">
          !
        </span>
        <div>
          <p className="connection-title">API unavailable</p>
          <p className="connection-detail">
            Start the API with <code>pnpm dev</code> to connect.
          </p>
        </div>
      </div>
    );
  }

  const checkedTime = new Intl.DateTimeFormat('en', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(connection.checkedAt));

  return (
    <div aria-live="polite" className="connection-state">
      <span className="state-icon state-icon-up" aria-hidden="true">
        ✓
      </span>
      <div>
        <p className="connection-title">All systems operational</p>
        <p className="connection-detail">
          Health check passed at {checkedTime} · {connection.health.version}
        </p>
      </div>
    </div>
  );
}
