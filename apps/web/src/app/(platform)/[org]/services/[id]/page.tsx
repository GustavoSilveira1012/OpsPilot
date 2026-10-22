import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import type {
  OrganizationMemberResponse,
  ServiceOwnerResponse,
  ServiceResponse,
} from '@opspilot/contracts';

import { ServiceDetails } from '@/components/services/service-details';
import { apiBaseUrl } from '@/lib/api';
import { getOrganizationMembership } from '@/lib/organizations';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Service Details | OpsPilot',
};

export default async function ServiceDetailsPage({ params }: PageProps<'/[org]/services/[id]'>) {
  const { org, id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))
    notFound();

  const membership = await getOrganizationMembership(org);
  const supabase = await createClient();

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims) {
    redirect('/login');
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) redirect('/login');

  let response: Response;

  try {
    response = await fetch(
      `${apiBaseUrl}/organizations/${encodeURIComponent(org)}/services/${encodeURIComponent(id)}`,
      {
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      },
    );
  } catch {
    throw new Error('The service API is unavailable. Please try again later.');
  }

  if (response.status === 401) redirect('/login');
  if (response.status === 404) notFound();

  if (!response.ok) {
    throw new Error('Unable to load service details.');
  }

  const service = (await response.json()) as ServiceResponse;
  async function load<T>(path: string): Promise<T> {
    const result = await fetch(`${apiBaseUrl}/organizations/${encodeURIComponent(org)}${path}`, {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${session!.access_token}` },
    });
    if (result.status === 401) redirect('/login');
    if (result.status === 403 || result.status === 404) notFound();
    if (!result.ok) throw new Error('Unable to load service ownership.');
    return result.json() as Promise<T>;
  }
  const canManage = membership.role === 'OWNER' || membership.role === 'ADMIN';
  const [owners, members] = await Promise.all([
    load<ServiceOwnerResponse[]>(`/services/${encodeURIComponent(id)}/owners`),
    canManage ? load<OrganizationMemberResponse[]>('/members') : Promise.resolve([]),
  ]);

  return (
    <ServiceDetails
      key={service.id}
      service={service}
      orgSlug={membership.organization.slug}
      role={membership.role}
      owners={owners}
      members={members}
    />
  );
}
