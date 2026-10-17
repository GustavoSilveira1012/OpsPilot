import type { ReactNode } from 'react';
import Link from 'next/link';
import { Brand } from '@/components/brand';
import { SignOutButton } from '@/components/sign-out-button';
import { getOrganization } from '@/lib/api/server';

export default async function OrganizationLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ org: string }>;
}) {
  const { org } = await params;
  const organization = await getOrganization(org);
  return (
    <div className="platform-shell">
      <aside className="platform-sidebar">
        <Brand />
        <div className="workspace-identity">
          <span className="workspace-avatar" aria-hidden="true">
            {organization.name[0]}
          </span>
          <div>
            <strong>{organization.name}</strong>
            <span>{organization.role.toLowerCase()}</span>
          </div>
        </div>
        <nav aria-label="Workspace">
          <Link className="sidebar-link" href={`/${organization.slug}/dashboard`}>
            Dashboard
          </Link>
          <Link className="sidebar-secondary" href="/onboarding">
            Switch workspace
          </Link>
        </nav>
        <div className="sidebar-bottom">
          <SignOutButton />
          <p>Ready for the unexpected.</p>
        </div>
      </aside>
      <main className="platform-content">{children}</main>
    </div>
  );
}
