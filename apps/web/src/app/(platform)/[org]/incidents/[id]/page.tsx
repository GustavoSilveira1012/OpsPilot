import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import type {
  IncidentDetailResponse,
  OrganizationMemberResponse,
  ServiceResponse,
} from '@opspilot/contracts';
import { IncidentDetails } from '@/components/incidents/incident-details';
import { apiBaseUrl } from '@/lib/api';
import { getOrganizationMembership } from '@/lib/organizations';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Incident Details | OpsPilot' };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function IncidentDetailsPage({ params }: PageProps<'/[org]/incidents/[id]'>) {
  const { org, id } = await params;
  if (!uuid.test(id)) notFound();
  const membership = await getOrganizationMembership(org);
  const supabase = await createClient();
  const { data: claims, error } = await supabase.auth.getClaims();
  if (error || !claims?.claims) redirect('/login');
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect('/login');
  const url = `${apiBaseUrl}/organizations/${encodeURIComponent(org)}`;
  async function load<T>(path: string): Promise<T> {
    const response = await fetch(`${url}${path}`, {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${session!.access_token}` },
    });
    if (response.status === 401) redirect('/login');
    if (response.status === 404) notFound();
    if (!response.ok) throw new Error('Unable to load incident details.');
    return (await response.json()) as T;
  }
  const canManage = membership.role === 'OWNER' || membership.role === 'ADMIN';
  const [incident, services, members] = await Promise.all([
    load<IncidentDetailResponse>(`/incidents/${encodeURIComponent(id)}`),
    load<ServiceResponse[]>('/services'),
    canManage ? load<OrganizationMemberResponse[]>('/members') : Promise.resolve([]),
  ]);
  return (
    <IncidentDetails
      key={incident.id}
      orgSlug={org}
      role={membership.role}
      incident={incident}
      services={services}
      members={members}
    />
  );
}
