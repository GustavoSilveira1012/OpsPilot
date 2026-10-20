import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import type { ServiceResponse } from '@opspilot/contracts';

import { ServiceDetails } from '@/components/services/service-details';
import { apiBaseUrl } from '@/lib/api';
import { getOrganizationMembership } from '@/lib/organizations';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Service Details | OpsPilot',
};

export default async function ServiceDetailsPage({ params }: PageProps<'/[org]/services/[id]'>) {
  const { org, id } = await params;

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

  return (
    <ServiceDetails
      service={service}
      orgSlug={membership.organization.slug}
      role={membership.role}
    />
  );
}
