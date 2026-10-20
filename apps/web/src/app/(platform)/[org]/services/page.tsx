import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { ServiceResponse } from '@opspilot/contracts';

import { ServiceCatalog } from '@/components/services/service-catalog';
import { apiBaseUrl } from '@/lib/api';
import { getOrganizationMembership } from '@/lib/organizations';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Services | OpsPilot',
};

type ServiceResult = {
  services: ServiceResponse[];
  error: string | null;
};

async function loadServices(org: string): Promise<ServiceResult> {
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) redirect('/login');

  let response: Response;

  try {
    response = await fetch(`${apiBaseUrl}/organizations/${encodeURIComponent(org)}/services`, {
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });
  } catch {
    return {
      services: [],
      error: 'The service API is currently unavailable.',
    };
  }

  if (response.status === 401) redirect('/login');

  if (!response.ok) {
    return {
      services: [],
      error: `Could not load services (HTTP ${response.status}).`,
    };
  }

  try {
    const data: unknown = await response.json();

    if (!Array.isArray(data)) {
      throw new Error('Unexpected response format');
    }

    return {
      services: data as ServiceResponse[],
      error: null,
    };
  } catch {
    return {
      services: [],
      error: 'The API returned an unexpected response.',
    };
  }
}

export default async function ServicesPage({ params }: PageProps<'/[org]/services'>) {
  const { org } = await params;

  const membership = await getOrganizationMembership(org);
  const result = await loadServices(org);

  return (
    <ServiceCatalog
      orgSlug={membership.organization.slug}
      orgName={membership.organization.name}
      role={membership.role}
      initialServices={result.services}
      loadError={result.error}
    />
  );
}
