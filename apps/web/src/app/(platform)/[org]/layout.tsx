import Link from 'next/link';
import { WorkspaceNav } from './workspace-nav';
import { getOrganizationMembership } from '@/lib/organizations';
import { SignOutButton } from './sign-out-button';
import styles from './workspace.module.css';

export default async function OrganizationLayout({ children, params }: LayoutProps<'/[org]'>) {
  const { org } = await params;
  const { organization, role } = await getOrganizationMembership(org);

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link aria-label="OpsPilot home" className="brand" href="/">
          <span aria-hidden="true" className="brand-mark">
            O
          </span>
          <span>OpsPilot</span>
        </Link>
        <div className={styles.identity}>
          <span className={styles.avatar} aria-hidden="true">
            {organization.name[0]}
          </span>
          <div>
            <strong>{organization.name}</strong>
            <span>{role.toLowerCase()}</span>
          </div>
        </div>
        <WorkspaceNav slug={organization.slug} />
        <div className={styles.sidebarBottom}>
          <SignOutButton />
          <p>Ready for the unexpected.</p>
        </div>
      </aside>
      <main className={styles.content}>{children}</main>
    </div>
  );
}
