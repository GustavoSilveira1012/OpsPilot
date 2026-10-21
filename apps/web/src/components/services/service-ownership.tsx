'use client';

import { type FormEvent, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type {
  OrganizationMemberResponse,
  OrganizationRole,
  ServiceOwnerResponse,
} from '@opspilot/contracts';
import { apiBaseUrl, readApiError } from '@/lib/api';
import { createClient } from '@/lib/supabase/client';
import styles from './service-ownership.module.css';

type Props = {
  orgSlug: string;
  serviceId: string;
  role: OrganizationRole;
  owners: ServiceOwnerResponse[];
  members: OrganizationMemberResponse[];
};

function memberLabel(member: OrganizationMemberResponse) {
  return member.displayName || member.email || `Member ${member.userId.slice(0, 8)}`;
}

export function ServiceOwnership({ orgSlug, serviceId, role, owners, members }: Props) {
  const router = useRouter();
  const canManage = role === 'OWNER' || role === 'ADMIN';
  const [selectedId, setSelectedId] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [refreshing, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const busy = pendingId !== null || refreshing;
  const candidates = members.filter(
    (member) => !owners.some((owner) => owner.userId === member.userId),
  );

  async function changeOwner(method: 'PUT' | 'DELETE', member: OrganizationMemberResponse) {
    if (!canManage || busy) return;
    setPendingId(member.userId);
    setError('');
    setSuccess('');
    try {
      const { data, error: sessionError } = await createClient().auth.getSession();
      if (sessionError) throw sessionError;
      if (!data.session) {
        router.replace('/login');
        router.refresh();
        return;
      }
      const response = await fetch(
        `${apiBaseUrl}/organizations/${encodeURIComponent(orgSlug)}/services/${encodeURIComponent(serviceId)}/owners/${encodeURIComponent(member.userId)}`,
        {
          method,
          signal: AbortSignal.timeout(10_000),
          headers: { Authorization: `Bearer ${data.session.access_token}` },
        },
      );
      if (response.status === 401) {
        router.replace('/login');
        router.refresh();
        return;
      }
      if (!response.ok) {
        setError(
          await readApiError(response, 'Could not update service ownership. Please try again.'),
        );
        if (response.status === 403 || response.status === 404)
          startTransition(() => router.refresh());
        return;
      }
      setSelectedId('');
      setSuccess(
        method === 'PUT'
          ? `${memberLabel(member)} assigned as a service owner.`
          : `${memberLabel(member)} removed from service ownership.`,
      );
      startTransition(() => router.refresh());
    } catch {
      setError(
        'The service API is unavailable. Your change could not be confirmed; refresh before trying again.',
      );
    } finally {
      setPendingId(null);
    }
  }

  function assign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const member = candidates.find((candidate) => candidate.userId === selectedId);
    if (member) void changeOwner('PUT', member);
  }

  return (
    <section className={styles.panel} aria-labelledby="service-ownership-title" aria-busy={busy}>
      <header className={styles.heading}>
        <div>
          <h2 id="service-ownership-title">Service ownership</h2>
          <p>People responsible for this service in your workspace.</p>
        </div>
        <span className={styles.count}>
          {owners.length} {owners.length === 1 ? 'owner' : 'owners'}
        </span>
      </header>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className={styles.success} role="status">
          {success}
        </p>
      )}
      {owners.length === 0 ? (
        <p className={styles.empty}>No active owners assigned.</p>
      ) : (
        <ul className={styles.owners}>
          {owners.map((owner) => (
            <li key={owner.userId}>
              <div className={styles.identity}>
                <span className={styles.avatar} aria-hidden="true">
                  {memberLabel(owner)[0]?.toUpperCase()}
                </span>
                <div>
                  <strong>{memberLabel(owner)}</strong>
                  {owner.displayName && owner.email && <span>{owner.email}</span>}
                  <small>Workspace {owner.role.toLowerCase()}</small>
                </div>
              </div>
              {canManage && (
                <button
                  type="button"
                  className={styles.remove}
                  disabled={busy}
                  aria-label={`Remove ${memberLabel(owner)} as owner`}
                  onClick={() => void changeOwner('DELETE', owner)}
                >
                  {pendingId === owner.userId ? 'Updating…' : 'Remove'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canManage ? (
        <form className={styles.form} onSubmit={assign}>
          <label htmlFor="service-owner">Assign an active workspace member</label>
          <div className={styles.controls}>
            <select
              id="service-owner"
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
              disabled={busy || candidates.length === 0}
              required
              aria-describedby="owner-help"
            >
              <option value="">Choose a member</option>
              {candidates.map((member) => (
                <option key={member.userId} value={member.userId}>
                  {memberLabel(member)} — {member.role.toLowerCase()}
                </option>
              ))}
            </select>
            <button
              className={styles.assign}
              type="submit"
              disabled={busy || !candidates.some((member) => member.userId === selectedId)}
            >
              {busy ? 'Updating…' : 'Assign owner'}
            </button>
          </div>
          <p className={styles.help} id="owner-help">
            {candidates.length === 0
              ? 'All active workspace members are already assigned.'
              : 'Only active members of this workspace can be selected.'}
          </p>
        </form>
      ) : (
        <p className={styles.help}>Workspace owners and admins manage service ownership.</p>
      )}
    </section>
  );
}
