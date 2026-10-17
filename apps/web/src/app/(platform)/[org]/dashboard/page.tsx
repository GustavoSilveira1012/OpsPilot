import type { Metadata } from 'next';
import { getOrganization } from '@/lib/api/server';

export const metadata: Metadata = { title: 'Dashboard | OpsPilot' };

export default async function DashboardPage({ params }: { params: Promise<{ org: string }> }) {
  // Pages/data operations also authorize access: layouts can be reused during navigation.
  const { org } = await params;
  const organization = await getOrganization(org);
  return (
    <>
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">{organization.name}</p>
          <h1>Dashboard</h1>
        </div>
        <span className="workspace-badge">Workspace ready</span>
      </header>
      <section className="dashboard-welcome" aria-labelledby="welcome-title">
        <span className="welcome-mark" aria-hidden="true">
          ✓
        </span>
        <p className="eyebrow">A CLEAR START</p>
        <h2 id="welcome-title">Your response workspace is ready.</h2>
        <p>This is your team’s home for coordinating incidents and keeping ownership clear.</p>
        <dl className="workspace-details">
          <div>
            <dt>Workspace</dt>
            <dd>{organization.slug}</dd>
          </div>
          <div>
            <dt>Your role</dt>
            <dd className="role-value">{organization.role.toLowerCase()}</dd>
          </div>
        </dl>
      </section>
    </>
  );
}
