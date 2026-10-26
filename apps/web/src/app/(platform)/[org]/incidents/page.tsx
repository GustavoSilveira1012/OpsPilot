import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { IncidentListResponse, ServiceResponse } from '@opspilot/contracts';
import { IncidentCatalog } from '@/components/incidents/incident-catalog';
import { apiBaseUrl } from '@/lib/api';
import { getOrganizationMembership } from '@/lib/organizations';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Incidents | OpsPilot' };

export default async function IncidentsPage({ params }: PageProps<'/[org]/incidents'>) {
  const { org } = await params;
  const membership = await getOrganizationMembership(org);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) redirect('/login');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect('/login');
  const base = `${apiBaseUrl}/organizations/${encodeURIComponent(org)}`;
  let incidents: IncidentListResponse = { items: [], total: 0 };
  let services: ServiceResponse[] = [];
  let loadError: string | null = null;
  try {
    const [incidentResult, serviceResult] = await Promise.all([
      fetch(`${base}/incidents?limit=25`, { cache: 'no-store', headers: { Authorization: `Bearer ${session.access_token}` } }),
      fetch(`${base}/services`, { cache: 'no-store', headers: { Authorization: `Bearer ${session.access_token}` } }),
    ]);
    if (incidentResult.status === 401 || serviceResult.status === 401) redirect('/login');
    if (!incidentResult.ok || !serviceResult.ok) throw new Error('Incident data could not be loaded.');
    incidents = (await incidentResult.json()) as IncidentListResponse;
    services = (await serviceResult.json()) as ServiceResponse[];
  } catch (error) {
    // Next.js redirects must not be swallowed by this fallback.
    if (error && typeof error === 'object' && 'digest' in error) throw error;
    loadError = 'Could not load incidents. Please retry.';
  }
  return <IncidentCatalog orgSlug={org} orgName={membership.organization.name} role={membership.role} initial={incidents} services={services} initialError={loadError} />;
}
