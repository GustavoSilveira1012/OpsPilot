'use client';

import Link from 'next/link';

export default function PlatformError({ reset }: { reset: () => void }) {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <h1>We couldn’t load your workspace.</h1>
        <p className="auth-description">Please try again in a moment.</p>
        <button className="form-submit" type="button" onClick={reset}>
          Try again
        </button>
        <p className="auth-switch">
          <Link href="/onboarding">Back to your workspaces</Link>
        </p>
      </section>
    </main>
  );
}
