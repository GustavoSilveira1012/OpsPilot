'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import type { CreateOrganizationRequest, OrganizationSummary } from '@opspilot/contracts';
import { apiBaseUrl, readApiError } from '@/lib/api';
import { createClient } from '@/lib/supabase/client';

function toSlug(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');
}

export function OnboardingForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [isSlugEdited, setIsSlugEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleNameChange(value: string) {
    setName(value);

    if (!isSlugEdited) {
      setSlug(toSlug(value));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setError(null);
    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace('/login');
        return;
      }

      const payload: CreateOrganizationRequest = { name: name.trim(), slug };

      const response = await fetch(`${apiBaseUrl}/organizations`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.status === 401) {
        router.replace('/login');
        return;
      }

      if (!response.ok) {
        setError(
          response.status === 409
            ? 'That workspace URL is already taken. Try another one.'
            : await readApiError(response, 'The workspace could not be created. Try again.'),
        );
        return;
      }

      const organization = (await response.json()) as OrganizationSummary;

      router.replace(`/${organization.slug}/dashboard`);
      router.refresh();
    } catch {
      setError('The OpsPilot API is unavailable. Check that it is running and try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form aria-busy={isSubmitting} className="auth-form" onSubmit={handleSubmit}>
      <label className="field">
        <span>Organization name</span>
        <input
          autoComplete="organization"
          disabled={isSubmitting}
          maxLength={120}
          minLength={2}
          name="name"
          onChange={(event) => handleNameChange(event.target.value)}
          placeholder="Acme Engineering"
          required
          value={name}
        />
      </label>

      <label className="field">
        <span>Workspace URL</span>
        <div className="url-field">
          <span aria-hidden="true">opspilot.app/</span>
          <input
            aria-describedby="slug-help"
            disabled={isSubmitting}
            maxLength={80}
            minLength={3}
            name="slug"
            onChange={(event) => {
              setIsSlugEdited(true);
              setSlug(event.target.value.toLowerCase());
            }}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            placeholder="acme-engineering"
            required
            value={slug}
          />
        </div>
        <small id="slug-help">Lowercase letters, numbers, and hyphens.</small>
      </label>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <button className="primary-button" disabled={isSubmitting} type="submit">
        {isSubmitting ? 'Creating workspace…' : 'Create workspace'}
      </button>
    </form>
  );
}
