'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import type { CreateIncidentRequest, IncidentListResponse, IncidentSeverity, IncidentStatus, OrganizationRole, ServiceResponse } from '@opspilot/contracts';
import { apiBaseUrl, readApiError } from '@/lib/api';
import { createClient } from '@/lib/supabase/client';
import styles from '@/components/services/service-catalog.module.css';

type Filters = { status: 'ALL' | IncidentStatus; severity: 'ALL' | IncidentSeverity; serviceId: string };
type Props = { orgSlug: string; orgName: string; role: OrganizationRole; initial: IncidentListResponse; services: ServiceResponse[]; initialError: string | null };
const statuses: IncidentStatus[] = ['INVESTIGATING', 'IDENTIFIED', 'MONITORING', 'RESOLVED'];
const severities: IncidentSeverity[] = ['SEV1', 'SEV2', 'SEV3', 'SEV4'];
const pageSize = 25;

export function IncidentCatalog({ orgSlug, orgName, role, initial, services, initialError }: Props) {
  const router = useRouter();
  const canManage = role === 'OWNER' || role === 'ADMIN';
  const [data, setData] = useState(initial);
  const [offset, setOffset] = useState(0);
  const [filters, setFilters] = useState<Filters>({ status: 'ALL', severity: 'ALL', serviceId: '' });
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [success, setSuccess] = useState('');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [severity, setSeverity] = useState<IncidentSeverity>('SEV3');
  const [serviceId, setServiceId] = useState('');
  const base = `${apiBaseUrl}/organizations/${encodeURIComponent(orgSlug)}/incidents`;

  async function authToken() {
    const { data: { session } } = await createClient().auth.getSession();
    if (!session) { router.replace('/login'); return null; }
    return session.access_token;
  }

  async function load(nextOffset: number, selected: Filters = filters) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const token = await authToken();
      if (!token) return;
      const query = new URLSearchParams({ offset: String(nextOffset), limit: String(pageSize) });
      if (selected.status !== 'ALL') query.set('status', selected.status);
      if (selected.severity !== 'ALL') query.set('severity', selected.severity);
      if (selected.serviceId) query.set('serviceId', selected.serviceId);
      const response = await fetch(`${base}?${query}`, { cache: 'no-store', signal: AbortSignal.timeout(12000), headers: { Authorization: `Bearer ${token}` } });
      if (response.status === 401) { router.replace('/login'); return; }
      if (!response.ok) { setError(await readApiError(response, 'Could not load incidents.')); return; }
      const next = (await response.json()) as IncidentListResponse;
      setData(next);
      setOffset(nextOffset);
    } catch { setError('The incident API is unavailable.'); }
    finally { setBusy(false); }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || busy) return;
    setBusy(true);
    setError(null);
    setSuccess('');
    let created = false;
    try {
      const token = await authToken();
      if (!token) return;
      const payload: CreateIncidentRequest = { title: title.trim(), summary: summary.trim() || null, severity, serviceId: serviceId || null };
      const response = await fetch(base, { method: 'POST', signal: AbortSignal.timeout(12000), headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (response.status === 401) { router.replace('/login'); return; }
      if (!response.ok) { setError(await readApiError(response, 'Could not create incident.')); return; }
      const incident = (await response.json()) as { number: number };
      setSuccess(`Incident #${incident.number} created.`);
      setShowForm(false);
      setTitle(''); setSummary(''); setServiceId(''); setSeverity('SEV3');
      created = true;
    } catch { setError('Creation could not be confirmed. Refresh before retrying.'); }
    finally { setBusy(false); }
    if (created) router.refresh();
  }

  // Search only affects the currently loaded page; server filters are status, severity, service.
  const visible = data.items.filter((item) => `${item.title} ${item.number} ${item.summary ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()));
  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div><p className={styles.eyebrow}>{orgName}</p><h1>Incidents</h1><p className={styles.muted}>Track engineering incidents and response history.</p></div>
        {canManage && <button className={styles.primaryButton} type="button" aria-expanded={showForm} onClick={() => setShowForm(v => !v)}>{showForm ? 'Close form' : '+ New incident'}</button>}
      </header>
      {error && <p role="alert" className={styles.alert}>{error}</p>}
      {success && <p role="status" className={styles.success}>{success}</p>}
      {showForm && canManage && (
        <form className={styles.form} onSubmit={create} aria-busy={busy}>
          <h2>Create incident</h2>
          <label className={styles.field}>Title<input required minLength={4} maxLength={200} disabled={busy} value={title} onChange={e => setTitle(e.target.value)} placeholder="Payment API returning errors" /></label>
          <div className={styles.formGrid}>
            <label className={styles.field}>Severity<select disabled={busy} value={severity} onChange={e => setSeverity(e.target.value as IncidentSeverity)}>{severities.map(v => <option key={v}>{v}</option>)}</select></label>
            <label className={styles.field}>Affected service<select disabled={busy} value={serviceId} onChange={e => setServiceId(e.target.value)}><option value="">None</option>{services.map(s => <option value={s.id} key={s.id}>{s.name}</option>)}</select></label>
          </div>
          <label className={styles.field}>Summary<textarea maxLength={10000} rows={3} disabled={busy} value={summary} onChange={e => setSummary(e.target.value)} /></label>
          <div className={styles.formActions}><button disabled={busy} className={styles.primaryButton} type="submit">{busy ? 'Creating…' : 'Create incident'}</button></div>
        </form>
      )}
      <div className={styles.stats}>
        <div className={styles.stat}><span>Matching incidents</span><strong>{data.total}</strong></div>
        <div className={styles.stat}><span>Current page</span><strong>{Math.floor(offset / pageSize) + 1}</strong></div>
        <div className={styles.stat}><span>Loaded</span><strong>{data.items.length}</strong></div>
      </div>
      <form className={styles.filters} onSubmit={e => { e.preventDefault(); void load(0); }}>
        <label className={styles.field}>Status<select value={filters.status} disabled={busy} onChange={e => setFilters(p => ({ ...p, status: e.target.value as Filters['status'] }))}><option value="ALL">All statuses</option>{statuses.map(s => <option key={s}>{s}</option>)}</select></label>
        <label className={styles.field}>Severity<select value={filters.severity} disabled={busy} onChange={e => setFilters(p => ({ ...p, severity: e.target.value as Filters['severity'] }))}><option value="ALL">All severities</option>{severities.map(s => <option key={s}>{s}</option>)}</select></label>
        <label className={styles.field}>Service<select value={filters.serviceId} disabled={busy} onChange={e => setFilters(p => ({ ...p, serviceId: e.target.value }))}><option value="">All services</option>{services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
        <button className={styles.primaryButton} disabled={busy} type="submit">{busy ? 'Loading…' : 'Apply filters'}</button>
      </form>
      <label className={styles.searchField}><span className={styles.muted}>Search this page</span><input type="search" placeholder="Title, number or summary…" value={search} onChange={e => setSearch(e.target.value)} /></label>
      <div className={styles.list} aria-busy={busy}>
        {visible.map(item => <Link key={item.id} href={`/${orgSlug}/incidents/${item.id}`} className={styles.serviceCard}>
          <span className={styles.serviceIcon} aria-hidden="true">!</span>
          <div className={styles.serviceInfo}><h2>#{item.number} — {item.title}</h2><p>{item.summary || 'No summary provided.'}</p><span className={styles.slug}>Started {new Date(item.startedAt).toLocaleString('en-US')}</span></div>
          <div className={styles.serviceMetadata}><span className={styles.status}>{item.status.replaceAll('_', ' ')}</span><span>{item.severity}</span></div>
        </Link>)}
        {!error && visible.length === 0 && <div className={styles.empty}><h2>No matching incidents</h2><p>Adjust your filters or create a new incident.</p></div>}
      </div>
      <div className={styles.formActions}>
        <button type="button" className={styles.secondaryButton} disabled={busy || offset === 0} onClick={() => void load(Math.max(0, offset - pageSize))}>Previous</button>
        <button type="button" className={styles.primaryButton} disabled={busy || offset + pageSize >= data.total} onClick={() => void load(offset + pageSize)}>Next page</button>
      </div>
    </section>
  );
}
