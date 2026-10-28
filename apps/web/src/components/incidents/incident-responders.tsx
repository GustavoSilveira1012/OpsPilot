'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import type { IncidentResponderResponse, OrganizationMemberResponse, OrganizationRole } from '@opspilot/contracts';
import { apiBaseUrl, readApiError } from '@/lib/api';
import { createClient } from '@/lib/supabase/client';
import styles from '@/components/services/service-details.module.css';

type Props = {
  orgSlug: string;
  incidentId: string;
  role: OrganizationRole;
  responders: IncidentResponderResponse[];
  members: OrganizationMemberResponse[];
};

function label(member: OrganizationMemberResponse) {
  return member.displayName || member.email || member.userId.slice(0, 8);
}

export function IncidentResponders({ orgSlug, incidentId, role, responders, members }: Props) {
  const router = useRouter();
  const canManage = role === 'OWNER' || role === 'ADMIN';
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshing, refresh] = useTransition();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const candidates = members.filter(member => !responders.some(r => r.userId === member.userId));
  async function change(method: 'PUT' | 'DELETE', target: string) {
    if (!canManage || busy || refreshing) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      const { data: { session } } = await createClient().auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const url = `${apiBaseUrl}/organizations/${encodeURIComponent(orgSlug)}/incidents/${encodeURIComponent(incidentId)}/responders/${encodeURIComponent(target)}`;
      const response = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${session.access_token}` },
        signal: AbortSignal.timeout(12000),
      });
      if (response.status === 401) { router.replace('/login'); return; }
      if (!response.ok) {
        setError(await readApiError(response, 'Could not update responders.'));
        return;
      }
      setSelected('');
      setSuccess(method === 'PUT' ? 'Responder assigned.' : 'Responder removed.');
      refresh(() => router.refresh());
    } catch { setError('Request could not be confirmed. Refresh before retrying.'); }
    finally { setBusy(false); }
  }
  return <section className={styles.panel} aria-labelledby="responders-title" aria-busy={busy || refreshing}>
    <h2 id="responders-title">Incident responders</h2>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {success && <p className={styles.success} role="status">{success}</p>}
    {responders.length === 0 && <p className={styles.note}>No active responders assigned.</p>}
    <ul>{responders.map(responder =>
      <li key={responder.userId}>
        <strong>{label(responder)}</strong>
        {canManage && <button className={styles.secondaryButton} disabled={busy || refreshing} type="button"
          aria-label={`Remove ${label(responder)} as responder`}
          onClick={() => void change('DELETE', responder.userId)}>Remove</button>}
      </li>
    )}</ul>
    {canManage && <form onSubmit={e => { e.preventDefault(); if (selected) void change('PUT', selected); }}>
      <label className={styles.field}>Assign a workspace member
        <select value={selected} disabled={busy || refreshing} onChange={e => setSelected(e.target.value)}>
          <option value="">Choose a member</option>
          {candidates.map(member => <option key={member.userId} value={member.userId}>{label(member)}</option>)}
        </select>
      </label>
      <div className={styles.actions}><button className={styles.primaryButton} type="submit" disabled={!selected || busy || refreshing}>Assign responder</button></div>
    </form>}
  </section>;
}
