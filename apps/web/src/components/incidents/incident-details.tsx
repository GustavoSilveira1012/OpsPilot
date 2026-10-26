'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState, useTransition } from 'react';
import type {
  IncidentDetailResponse,
  IncidentEventResponse,
  IncidentSeverity,
  IncidentStatus,
  OrganizationMemberResponse,
  OrganizationRole,
  ServiceResponse,
  UpdateIncidentRequest,
} from '@opspilot/contracts';
import { apiBaseUrl, readApiError } from '@/lib/api';
import { createClient } from '@/lib/supabase/client';
import styles from '@/components/services/service-details.module.css';

type Props = {
  orgSlug: string;
  role: OrganizationRole;
  incident: IncidentDetailResponse;
  services: ServiceResponse[];
  members: OrganizationMemberResponse[];
};
const statuses: IncidentStatus[] = ['INVESTIGATING', 'IDENTIFIED', 'MONITORING', 'RESOLVED'];
const severities: IncidentSeverity[] = ['SEV1', 'SEV2', 'SEV3', 'SEV4'];
const transitions: Record<IncidentStatus, IncidentStatus[]> = {
  INVESTIGATING: ['IDENTIFIED', 'MONITORING', 'RESOLVED'],
  IDENTIFIED: ['INVESTIGATING', 'MONITORING', 'RESOLVED'],
  MONITORING: ['INVESTIGATING', 'IDENTIFIED', 'RESOLVED'],
  RESOLVED: ['INVESTIGATING'],
};
function time(value: string) {
  return new Date(value).toLocaleString('en-US');
}
function readable(value: string) {
  return value.replaceAll('_', ' ').toLowerCase();
}
function memberName(member: OrganizationMemberResponse) {
  return member.displayName || member.email || member.userId.slice(0, 8);
}

export function IncidentDetails({ orgSlug, role, incident, services, members }: Props) {
  const router = useRouter();
  const canManage = role === 'OWNER' || role === 'ADMIN';
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<IncidentStatus>(incident.status);
  const [severity, setSeverity] = useState<IncidentSeverity>(incident.severity);
  const [summary, setSummary] = useState(incident.summary || '');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const busy = saving || pending;
  const base = `${apiBaseUrl}/organizations/${encodeURIComponent(orgSlug)}/incidents/${encodeURIComponent(incident.id)}`;
  const currentService = services.find((service) => service.id === incident.serviceId);
  async function send(method: string, route: string, body?: unknown): Promise<boolean> {
    if (busy) return false;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const {
        data: { session },
      } = await createClient().auth.getSession();
      if (!session) {
        router.replace('/login');
        return false;
      }
      const response = await fetch(`${base}${route}`, {
        method,
        cache: 'no-store',
        signal: AbortSignal.timeout(12000),
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (response.status === 401) {
        router.replace('/login');
        return false;
      }
      if (!response.ok) {
        setError(await readApiError(response, 'Could not save incident changes.'));
        return false;
      }
      setSuccess('Changes saved.');
      startTransition(() => router.refresh());
      return true;
    } catch {
      setError('The request could not be confirmed. Refresh before trying again.');
      return false;
    } finally {
      setSaving(false);
    }
  }
  async function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const payload: UpdateIncidentRequest = {};
    if (status !== incident.status) payload.status = status;
    if (severity !== incident.severity) payload.severity = severity;
    if ((summary.trim() || null) !== incident.summary) payload.summary = summary.trim() || null;
    if (Object.keys(payload).length === 0) {
      setSuccess('No changes to save.');
      return;
    }
    await send('PATCH', '', payload);
  }
  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!note.trim()) return;
    if (await send('POST', '/notes', { message: note.trim() })) setNote('');
  }
  function formatEvent(event: IncidentEventResponse) {
    if (event.type === 'MESSAGE_ADDED') return event.message || 'Note added';
    return readable(event.type);
  }
  return (
    <section className={styles.page}>
      <Link href={`/${orgSlug}/incidents`} className={styles.backLink}>
        ← Back to incidents
      </Link>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>INCIDENT #{incident.number}</p>
          <h1>{incident.title}</h1>
          <p className={styles.subtitle}>
            Started {time(incident.startedAt)} ·{' '}
            {currentService?.name ||
              (incident.serviceId ? 'Archived service' : 'Unassigned service')}
          </p>
        </div>
        <span className={styles.statusBadge}>
          {incident.status.replaceAll('_', ' ')} · {incident.severity}
        </span>
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
      <section className={styles.panel} aria-labelledby="incident-facts">
        <h2 id="incident-facts">Incident overview</h2>
        <dl className={styles.detailsGrid}>
          <div>
            <dt>Status</dt>
            <dd>{incident.status}</dd>
          </div>
          <div>
            <dt>Severity</dt>
            <dd>{incident.severity}</dd>
          </div>
          <div>
            <dt>Created by</dt>
            <dd>
              {members.find((m) => m.userId === incident.createdByUserId)?.displayName ||
                incident.createdByUserId.slice(0, 8)}
            </dd>
          </div>
          <div>
            <dt>Resolved</dt>
            <dd>{incident.resolvedAt ? time(incident.resolvedAt) : 'Not resolved'}</dd>
          </div>
        </dl>
        <p className={styles.description}>{incident.summary || 'No summary provided.'}</p>
      </section>
      {canManage && (
        <form className={styles.panel} onSubmit={update} aria-busy={busy}>
          <h2>Update incident</h2>
          <div className={styles.formGrid}>
            <label className={styles.field}>
              Status
              <select
                value={status}
                disabled={busy}
                onChange={(event) => setStatus(event.target.value as IncidentStatus)}
              >
                {statuses
                  .filter(
                    (item) =>
                      item === incident.status || transitions[incident.status].includes(item),
                  )
                  .map((item) => (
                    <option key={item} value={item}>
                      {item.replaceAll('_', ' ')}
                    </option>
                  ))}
              </select>
            </label>
            <label className={styles.field}>
              Severity
              <select
                value={severity}
                disabled={busy}
                onChange={(event) => setSeverity(event.target.value as IncidentSeverity)}
              >
                {severities.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className={styles.field}>
            Summary
            <textarea
              rows={4}
              value={summary}
              maxLength={10000}
              disabled={busy}
              onChange={(event) => setSummary(event.target.value)}
            />
          </label>
          <div className={styles.actions}>
            <button type="submit" disabled={busy} className={styles.primaryButton}>
              {busy ? 'Saving…' : 'Save incident changes'}
            </button>
          </div>
        </form>
      )}
      <section className={styles.panel} aria-labelledby="incident-timeline">
        <h2 id="incident-timeline">Activity timeline</h2>
        <ol>
          {incident.timeline.map((event) => (
            <li key={event.id}>
              <strong>{formatEvent(event)}</strong>
              <p className={styles.note}>
                {time(event.occurredAt)} · Actor: {event.actorUserId?.slice(0, 8) || 'System'}
              </p>
            </li>
          ))}
        </ol>
        {incident.timeline.length === 0 && <p className={styles.note}>No timeline events yet.</p>}
        <form onSubmit={addNote} className={styles.field} aria-busy={busy}>
          <label htmlFor="incident-note">Add a timeline note</label>
          <textarea
            id="incident-note"
            rows={3}
            maxLength={4000}
            minLength={1}
            required
            value={note}
            disabled={busy}
            onChange={(event) => setNote(event.target.value)}
            placeholder="What changed during the investigation?"
          />
          <div className={styles.actions}>
            <button type="submit" disabled={busy || !note.trim()} className={styles.primaryButton}>
              {busy ? 'Posting…' : 'Post note'}
            </button>
          </div>
        </form>
      </section>
      <p className={styles.note}>
        Incident responder assignments and changing the affected service will be enabled once the
        OPS-005E endpoints are available in the merged API.
      </p>
    </section>
  );
}
