'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import {
  organizationSlugPattern,
  reservedOrganizationSlugs,
  type CreateOrganizationInput,
  type OrganizationSummary,
} from '@opspilot/contracts';
import { createClient } from '@/lib/supabase/client';
import { getApiBaseUrl } from '@/lib/api/config';

function suggestSlug(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
    .replace(/-$/, '');
}

export function CreateWorkspaceForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [sessionExpired, setSessionExpired] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError('');
    setSessionExpired(false);
    if (
      !organizationSlugPattern.test(slug) ||
      reservedOrganizationSlugs.some((value) => value === slug)
    ) {
      setError(
        'Choose another workspace URL using lowercase letters, numbers, and single hyphens.',
      );
      return;
    }
    setPending(true);
    try {
      const { data, error: sessionError } = await createClient().auth.getSession();
      if (sessionError || !data.session) {
        setError('Your session has expired. Sign in again to create a workspace.');
        setSessionExpired(true);
        return;
      }
      const input: CreateOrganizationInput = { name: name.trim(), slug };
      const response = await fetch(`${getApiBaseUrl()}/organizations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${data.session.access_token}`,
        },
        body: JSON.stringify(input),
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
      });
      if (response.status === 401) {
        setSessionExpired(true);
        setError('Your session has expired. Sign in again to continue.');
        return;
      }
      if (response.status === 409) {
        setError('That workspace URL is already in use. Try another one.');
        return;
      }
      if (response.status === 403) {
        setError('This account cannot create a workspace. Contact your administrator.');
        return;
      }
      if (!response.ok) {
        setError('We couldn’t create your workspace. Check the details and try again.');
        return;
      }
      const organization = (await response.json()) as OrganizationSummary;
      router.replace(`/${encodeURIComponent(organization.slug)}/dashboard`);
      router.refresh();
    } catch {
      setError('We couldn’t reach the workspace service. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="form-stack" onSubmit={submit} aria-busy={pending}>
      <div className="form-field">
        <label htmlFor="organization-name">Organization name</label>
        <input
          id="organization-name"
          name="name"
          required
          minLength={2}
          maxLength={120}
          autoComplete="organization"
          placeholder="Acme Engineering"
          value={name}
          disabled={pending}
          onChange={(event) => {
            setName(event.target.value);
            if (!slugEdited) setSlug(suggestSlug(event.target.value));
          }}
        />
      </div>
      <div className="form-field">
        <label htmlFor="organization-slug">Workspace URL</label>
        <div className="slug-input">
          <span aria-hidden="true">opspilot.app/</span>
          <input
            id="organization-slug"
            name="slug"
            required
            minLength={3}
            maxLength={80}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            value={slug}
            disabled={pending}
            onChange={(event) => {
              setSlugEdited(true);
              setSlug(event.target.value.toLowerCase());
            }}
            aria-describedby="slug-hint"
            placeholder="acme-engineering"
          />
        </div>
        <p className="field-hint" id="slug-hint">
          3–80 characters. Lowercase letters, numbers, and single hyphens.
        </p>
      </div>
      {error && (
        <div className="form-error" role="alert">
          <p>{error}</p>
          {sessionExpired && <Link href="/login">Sign in again</Link>}
        </div>
      )}
      <button type="submit" className="form-submit" disabled={pending}>
        {pending ? 'Creating workspace…' : 'Create workspace'}
        <span aria-hidden="true">→</span>
      </button>
      <p className="field-hint">You’ll be the workspace owner. Your team can join as it grows.</p>
    </form>
  );
}
