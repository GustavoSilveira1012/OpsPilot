import 'server-only';
import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import type { OrganizationMembershipResponse } from '@opspilot/contracts';
import { apiBaseUrl } from '@/lib/api';
import { createClient } from '@/lib/supabase/server';

/**
 * Asks the API whether the signed-in user has an ACTIVE membership in `slug`.
 * The API verifies the JWT and the membership, so this is the tenant-isolation
 * check for every /[org] route. Cached per request so layout and page share it.
 */
export const getOrganizationMembership = cache(
  async (slug: string): Promise<OrganizationMembershipResponse> => {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();
    if (error || !data?.claims) redirect('/login');
    // The session token is only forwarded here; the API verifies its signature.
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      redirect('/login');
    }

    const response = await fetch(
      `${apiBaseUrl}/organizations/${encodeURIComponent(slug)}/membership`,
      {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${session.access_token}` },
      },
    );

    if (response.status === 401) {
      redirect('/login');
    }

    if (response.status === 404) {
      notFound();
    }

    if (!response.ok) {
      throw new Error(`Membership check failed with status ${response.status}.`);
    }

    return (await response.json()) as OrganizationMembershipResponse;
  },
);

export const listOrganizationMemberships = cache(
  async (): Promise<OrganizationMembershipResponse[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();
    if (error || !data?.claims) redirect('/login');
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) redirect('/login');
    const response = await fetch(`${apiBaseUrl}/organizations`, {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
    });
    if (response.status === 401) redirect('/login');
    if (!response.ok) throw new Error('The workspace service is temporarily unavailable.');
    return response.json() as Promise<OrganizationMembershipResponse[]>;
  },
);
