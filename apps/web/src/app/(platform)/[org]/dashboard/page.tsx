import type { Metadata } from 'next';
import { getOrganizationMembership } from '@/lib/organizations';
import styles from '../workspace.module.css';

export const metadata: Metadata = { title: 'Dashboard | OpsPilot' };

export default async function DashboardPage({ params }: PageProps<'/[org]/dashboard'>) {
  const { org } = await params;
  const { organization, role } = await getOrganizationMembership(org);

  return (
    <>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>{organization.name}</p>
          <h1>Dashboard</h1>
        </div>
        <span className={styles.badge}>Workspace ready</span>
      </header>
      <section className={styles.welcome} aria-labelledby="welcome-title">
        <span className={styles.welcomeMark} aria-hidden="true">
          ✓
        </span>
        <p className={styles.eyebrow}>A CLEAR START</p>
        <h2 id="welcome-title">Your response workspace is ready.</h2>
        <p className={styles.description}>
          This is your team’s home for coordinating incidents and keeping ownership clear.
        </p>
        <dl className={styles.details}>
          <div>
            <dt>Workspace</dt>
            <dd>{organization.slug}</dd>
          </div>
          <div>
            <dt>Your role</dt>
            <dd className={styles.role}>{role.toLowerCase()}</dd>
          </div>
        </dl>
      </section>
    </>
  );
}
