'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';

import type {
  OrganizationRole,
  ServiceResponse,
  ServiceStatus,
  ServiceTier,
  UpdateServiceRequest,
} from '@opspilot/contracts';

import { apiBaseUrl, readApiError } from '@/lib/api';
import { createClient } from '@/lib/supabase/client';
import styles from './service-details.module.css';

type Props = {
  service: ServiceResponse;
  orgSlug: string;
  role: OrganizationRole;
};

const tiers: ServiceTier[] = ['TIER_0', 'TIER_1', 'TIER_2', 'TIER_3'];

const statuses: ServiceStatus[] = [
  'OPERATIONAL',
  'DEGRADED',
  'PARTIAL_OUTAGE',
  'MAJOR_OUTAGE',
  'MAINTENANCE',
];

function formatValue(value: string) {
  return value.replaceAll('_', ' ');
}

export function ServiceDetails({ service, orgSlug, role }: Props) {
  const router = useRouter();
  const canManage = role === 'OWNER' || role === 'ADMIN';

  const [current, setCurrent] = useState(service);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [name, setName] = useState(service.name);
  const [description, setDescription] = useState(service.description ?? '');
  const [tier, setTier] = useState<ServiceTier>(service.tier);
  const [status, setStatus] = useState<ServiceStatus>(service.status);
  const [runbookUrl, setRunbookUrl] = useState(service.runbookUrl ?? '');

  const basePath = `/${orgSlug}/services`;
  const endpoint =
    `${apiBaseUrl}/organizations/` +
    `${encodeURIComponent(orgSlug)}/services/` +
    encodeURIComponent(current.id);

  const isBusy = saving || archiving;

  function resetFields() {
    setName(current.name);
    setDescription(current.description ?? '');
    setTier(current.tier);
    setStatus(current.status);
    setRunbookUrl(current.runbookUrl ?? '');
  }

  async function getAccessToken(): Promise<string | null> {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      router.replace('/login');
      return null;
    }

    return session.access_token;
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManage || isBusy) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const token = await getAccessToken();
      if (!token) return;

      const payload: UpdateServiceRequest = {
        name: name.trim(),
        description: description.trim() || null,
        tier,
        status,
        runbookUrl: runbookUrl.trim() || null,
      };

      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 401) {
        router.replace('/login');
        return;
      }

      if (!response.ok) {
        setError(await readApiError(response, 'Could not update the service.'));
        return;
      }

      const updated = (await response.json()) as ServiceResponse;

      setCurrent(updated);
      setEditing(false);
      setSuccess('Service updated successfully.');

      router.refresh();
    } catch {
      setError('The API is unavailable. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive() {
    if (!canManage || isBusy) return;

    const confirmed = window.confirm(
      `Archive "${current.name}"?\n\n` +
        'It will disappear from the active service catalog. ' +
        'Related incidents will be preserved.',
    );

    if (!confirmed) return;

    setArchiving(true);
    setError(null);
    setSuccess(null);

    try {
      const token = await getAccessToken();
      if (!token) return;

      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        router.replace('/login');
        return;
      }

      if (!response.ok) {
        setError(await readApiError(response, 'Could not archive the service.'));
        return;
      }

      router.replace(basePath);
      router.refresh();
    } catch {
      setError('The API is unavailable. Please try again.');
    } finally {
      setArchiving(false);
    }
  }

  const runbookLink =
    current.runbookUrl && /^https?:\/\//i.test(current.runbookUrl) ? current.runbookUrl : null;

  return (
    <div className={styles.page}>
      <Link href={basePath} className={styles.backLink}>
        ← Back to services
      </Link>

      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>SERVICE MANAGEMENT</p>
          <h1>{current.name}</h1>
          <p className={styles.subtitle}>{current.slug}</p>
        </div>

        <div className={styles.headerActions}>
          <span className={styles.statusBadge}>{formatValue(current.status)}</span>

          {canManage && !editing && (
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => {
                resetFields();
                setError(null);
                setSuccess(null);
                setEditing(true);
              }}
            >
              Edit service
            </button>
          )}
        </div>
      </header>

      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}

      {success && (
        <p role="status" className={styles.success}>
          {success}
        </p>
      )}

      {!editing ? (
        <section className={styles.panel}>
          <h2>Service information</h2>

          <dl className={styles.detailsGrid}>
            <div>
              <dt>Criticality tier</dt>
              <dd>{formatValue(current.tier)}</dd>
            </div>

            <div>
              <dt>Declared operational status</dt>
              <dd>{formatValue(current.status)}</dd>
            </div>

            <div>
              <dt>Created</dt>
              <dd>{new Date(current.createdAt).toLocaleDateString('en-US')}</dd>
            </div>

            <div>
              <dt>Last updated</dt>
              <dd>{new Date(current.updatedAt).toLocaleDateString('en-US')}</dd>
            </div>
          </dl>

          <h3>Description</h3>
          <p className={styles.description}>{current.description || 'No description provided.'}</p>

          <h3>Runbook</h3>
          {runbookLink ? (
            <a
              href={runbookLink}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.backLink}
            >
              Open runbook ↗
            </a>
          ) : (
            <p className={styles.description}>No runbook registered.</p>
          )}

          <p className={styles.note}>
            Operational status is managed manually. Automated monitoring will be added later.
          </p>
        </section>
      ) : (
        <form className={styles.panel} aria-busy={saving} onSubmit={handleSave}>
          <h2>Edit service</h2>

          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span>Name</span>
              <input
                required
                minLength={2}
                maxLength={160}
                value={name}
                disabled={isBusy}
                onChange={(e) => setName(e.target.value)}
              />
            </label>

            <label className={styles.field}>
              <span>Criticality tier</span>
              <select
                value={tier}
                disabled={isBusy}
                onChange={(e) => setTier(e.target.value as ServiceTier)}
              >
                {tiers.map((value) => (
                  <option key={value} value={value}>
                    {formatValue(value)}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span>Operational status</span>
              <select
                value={status}
                disabled={isBusy}
                onChange={(e) => setStatus(e.target.value as ServiceStatus)}
              >
                {statuses.map((value) => (
                  <option key={value} value={value}>
                    {formatValue(value)}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span>Runbook URL</span>
              <input
                type="url"
                maxLength={2048}
                value={runbookUrl}
                disabled={isBusy}
                placeholder="https://docs.example.com/runbook"
                onChange={(e) => setRunbookUrl(e.target.value)}
              />
            </label>
          </div>

          <label className={styles.field}>
            <span>Description</span>
            <textarea
              rows={4}
              maxLength={2000}
              value={description}
              disabled={isBusy}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.secondaryButton}
              disabled={isBusy}
              onClick={() => {
                resetFields();
                setEditing(false);
                setError(null);
              }}
            >
              Cancel
            </button>

            <button type="submit" className={styles.primaryButton} disabled={isBusy}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      )}

      {canManage && !editing && (
        <section className={styles.dangerZone}>
          <div>
            <h2>Archive service</h2>
            <p>
              Remove this service from the active catalog without deleting its incident history.
            </p>
          </div>

          <button
            type="button"
            className={styles.dangerButton}
            disabled={isBusy}
            onClick={handleArchive}
          >
            {archiving ? 'Archiving…' : 'Archive service'}
          </button>
        </section>
      )}
    </div>
  );
}
