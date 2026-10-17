import 'server-only';
import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import { organizationSlugPattern, type OrganizationSummary } from '@opspilot/contracts';
import { createClient } from '@/lib/supabase/server';
import { getApiBaseUrl } from './config';

async function apiGet<T>(path: string): Promise<T> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) redirect('/login');
  // getSession supplies only the bearer token; NestJS verifies it independently.
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.access_token) redirect('/login');
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
    cache: 'no-store',
  });
  if (response.status === 401) redirect('/login');
  if (response.status === 403 || response.status === 404) notFound();
  if (!response.ok) throw new Error('The workspace service is temporarily unavailable.');
  return response.json() as Promise<T>;
}

// React cache deduplicates within a single render, never across users or requests.
export const listOrganizations = cache(() => apiGet<OrganizationSummary[]>('/organizations'));
export const getOrganization = cache((slug: string) => {
  if (slug.length < 3 || slug.length > 80 || !organizationSlugPattern.test(slug)) notFound();
  return apiGet<OrganizationSummary>(`/organizations/${encodeURIComponent(slug)}`);
});
