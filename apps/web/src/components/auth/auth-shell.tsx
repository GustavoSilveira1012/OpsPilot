import Link from 'next/link';
import type { ReactNode } from 'react';

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="page-shell">
      <header className="topbar">
        <Link aria-label="OpsPilot home" className="brand" href="/">
          <span aria-hidden="true" className="brand-mark">
            O
          </span>
          <span>OpsPilot</span>
        </Link>
        <span className="topbar-label">ENGINEERING OPERATIONS</span>
      </header>

      <section className="auth-panel">
        <div className="auth-card">
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="auth-title">{title}</h1>
          <p className="auth-description">{description}</p>
          {children}
        </div>
        {footer ? <p className="auth-footer">{footer}</p> : null}
      </section>
    </main>
  );
}
