import Link from 'next/link';

export default function WorkspaceNotFound() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <h1>Workspace unavailable.</h1>
        <p className="auth-description">This workspace isn’t available to your account.</p>
        <Link className="primary-link" href="/onboarding">
          Go to your workspaces →
        </Link>
      </section>
    </main>
  );
}
