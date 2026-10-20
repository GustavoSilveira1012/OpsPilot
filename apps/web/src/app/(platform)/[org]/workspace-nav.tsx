'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './workspace.module.css';

export function WorkspaceNav({ slug }: { slug: string }) {
  const pathname = usePathname();

  const links = [
    {
      label: 'Dashboard',
      href: `/${slug}/dashboard`,
    },
    {
      label: 'Services',
      href: `/${slug}/services`,
    },
  ];

  return (
    <nav aria-label="Workspace" className={styles.navigation}>
      {links.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.href}/`);

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? 'page' : undefined}
            className={active ? styles.activeLink : styles.secondaryLink}
          >
            {link.label}
          </Link>
        );
      })}

      <Link className={styles.secondaryLink} href="/onboarding">
        Switch workspace
      </Link>
    </nav>
  );
}
