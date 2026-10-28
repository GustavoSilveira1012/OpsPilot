'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import type {
  CreateServiceRequest,
  OrganizationRole,
  ServiceResponse,
  ServiceTier,
} from '@opspilot/contracts';

import { apiBaseUrl, readApiError } from '@/lib/api';
import { createClient } from '@/lib/supabase/client';
import styles from './service-catalog.module.css';

type Props = {
  orgSlug: string;
  orgName: string;
  role: OrganizationRole;
  initialServices: ServiceResponse[];
  loadError: string | null;
};

const tiers: ServiceTier[] = ['TIER_0', 'TIER_1', 'TIER_2', 'TIER_3'];

function makeSlug(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100)
    .replace(/-+$/, '');
}

export function ServiceCatalog({ orgSlug, orgName, role, initialServices, loadError }: Props) {
  const router = useRouter();
  const canManage = role === 'OWNER' || role === 'ADMIN';

  const [query, setQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<'ALL' | ServiceTier>('ALL');

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState('');
  const [tier, setTier] = useState<ServiceTier>('TIER_2');
  const [runbookUrl, setRunbookUrl] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const services = initialServices.filter((service) => {
    const matchesSearch = [service.name, service.slug, service.description ?? '']
      .join(' ')
      .toLowerCase()
      .includes(query.toLowerCase().trim());

    return matchesSearch && (tierFilter === 'ALL' || service.tier === tierFilter);
  });

  const operationalCount = initialServices.filter((s) => s.status === 'OPERATIONAL').length;

  const degradedCount = initialServices.filter(
    (s) => s.status === 'DEGRADED' || s.status === 'PARTIAL_OUTAGE' || s.status === 'MAJOR_OUTAGE',
  ).length;

  function updateName(value: string) {
    setName(value);
    if (!slugEdited) setSlug(makeSlug(value));
  }

  function resetForm() {
    setName('');
    setSlug('');
    setSlugEdited(false);
    setDescription('');
    setTier('TIER_2');
    setRunbookUrl('');
    setFormError(null);
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManage || isSubmitting) return;

    setIsSubmitting(true);
    setFormError(null);
    setSuccess(null);

    try {
      const supabase = createClient();

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace('/login');
        return;
      }

      const payload: CreateServiceRequest = {
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim() || null,
        tier,
        runbookUrl: runbookUrl.trim() || null,
      };

      const response = await fetch(
        `${apiBaseUrl}/organizations/${encodeURIComponent(orgSlug)}/services`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
      );

      if (response.status === 401) {
        router.replace('/login');
        return;
      }

      if (response.status === 403) {
        setFormError('You do not have permission to create services.');
        return;
      }

      if (response.status === 409) {
        setFormError('This service slug is already used in this workspace.');
        return;
      }

      if (!response.ok) {
        setFormError(await readApiError(response, 'Unable to create the service.'));
        return;
      }

      setSuccess(`Service "${payload.name}" created successfully.`);
      setShowForm(false);
      resetForm();

      // Refetch server-side data from NestJS.
      router.refresh();
    } catch {
      setFormError('Could not connect to the API. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{orgName}</p>
          <h1>Services</h1>
          <p className={styles.muted}>Manage the applications your engineering team operates.</p>
        </div>

        {canManage && (
          <button
            className={styles.primaryButton}
            type="button"
            onClick={() => {
              setShowForm((value) => !value);
              setFormError(null);
            }}
            aria-expanded={showForm}
            aria-controls="create-service-form"
          >
            {showForm ? 'Close form' : '+ New service'}
          </button>
        )}
      </header>

      {loadError && (
        <div className={styles.alert} role="alert">
          {loadError}
        </div>
      )}

      {success && (
        <div className={styles.success} role="status">
          {success}
        </div>
      )}

      {showForm && canManage && (
        <form
          id="create-service-form"
          className={styles.form}
          onSubmit={handleCreate}
          aria-busy={isSubmitting}
        >
          <h2>Register a service</h2>

          <div className={styles.formGrid}>
            <label className={styles.field}>
              <span>Service name</span>
              <input
                required
                minLength={2}
                maxLength={160}
                value={name}
                disabled={isSubmitting}
                placeholder="Payment API"
                onChange={(e) => updateName(e.target.value)}
              />
            </label>

            <label className={styles.field}>
              <span>Service slug</span>
              <input
                required
                minLength={3}
                maxLength={100}
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                value={slug}
                disabled={isSubmitting}
                placeholder="payment-api"
                onChange={(e) => {
                  setSlugEdited(true);
                  setSlug(e.target.value.toLowerCase());
                }}
              />
            </label>

            <label className={styles.field}>
              <span>Criticality tier</span>
              <select
                value={tier}
                disabled={isSubmitting}
                onChange={(e) => setTier(e.target.value as ServiceTier)}
              >
                {tiers.map((item) => (
                  <option key={item} value={item}>
                    {item.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span>Runbook URL (optional)</span>
              <input
                type="url"
                maxLength={2048}
                value={runbookUrl}
                disabled={isSubmitting}
                placeholder="https://docs.example.com/runbooks"
                onChange={(e) => setRunbookUrl(e.target.value)}
              />
            </label>
          </div>

          <label className={styles.field}>
            <span>Description (optional)</span>
            <textarea
              rows={3}
              maxLength={2000}
              value={description}
              disabled={isSubmitting}
              placeholder="What does this service do?"
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          {formError && (
            <p className={styles.alert} role="alert">
              {formError}
            </p>
          )}

          <div className={styles.formActions}>
            <button
              type="button"
              className={styles.secondaryButton}
              disabled={isSubmitting}
              onClick={() => {
                resetForm();
                setShowForm(false);
              }}
            >
              Cancel
            </button>

            <button className={styles.primaryButton} type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating…' : 'Create service'}
            </button>
          </div>
        </form>
      )}

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span>Total services</span>
          <strong>{initialServices.length}</strong>
        </div>
        <div className={styles.stat}>
          <span>Declared operational</span>
          <strong>{operationalCount}</strong>
        </div>
        <div className={styles.stat}>
          <span>Declared degraded/outage</span>
          <strong>{degradedCount}</strong>
        </div>
      </div>

      <p className={styles.note}>
        Statuses are manually declared in OPS-004. Live monitoring comes in a later sprint.
      </p>

      <div className={styles.filters}>
        <label className={styles.searchField}>
          <span className={styles.srOnly}>Search services</span>
          <input
            type="search"
            placeholder="Search by name, slug or description..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>

        <label className={styles.filterField}>
          <span className={styles.srOnly}>Filter by tier</span>
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value as 'ALL' | ServiceTier)}
          >
            <option value="ALL">All tiers</option>
            {tiers.map((item) => (
              <option key={item} value={item}>
                {item.replace('_', ' ')}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.list}>
        {services.map((service) => (
          <Link
            key={service.id}
            href={`/${orgSlug}/services/${service.id}`}
            className={styles.serviceCard}
            aria-label={`View details for ${service.name}`}
          >
            <div className={styles.serviceIcon} aria-hidden="true">
              ◈
            </div>

            <div className={styles.serviceInfo}>
              <h2>{service.name}</h2>
              <p>{service.description || 'No description provided.'}</p>
              <span className={styles.slug}>{service.slug}</span>
            </div>

            <div className={styles.serviceMetadata}>
              <span className={styles.status}>{service.status.replaceAll('_', ' ')}</span>
              <span>{service.tier.replace('_', ' ')}</span>
            </div>
          </Link>
        ))}

        {!loadError && services.length === 0 && (
          <div className={styles.empty}>
            <h2>
              {initialServices.length === 0 ? 'No services registered yet' : 'No matching services'}
            </h2>
            <p>
              {initialServices.length === 0
                ? 'Register your first service to begin.'
                : 'Try another search or tier filter.'}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
