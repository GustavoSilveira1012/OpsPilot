import Link from 'next/link';

export default function WorkspaceNotFound() {
  return (
    <main className="page-shell workspace-main">
      <h1 className="workspace-title">Workspace unavailable.</h1>
      <p className="hero-description">This workspace isn’t available to your account.</p>
      <Link className="primary-link" href="/onboarding">
        Go to your workspaces →
      </Link>
    </main>
  );
}
