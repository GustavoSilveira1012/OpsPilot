'use client';

export default function PlatformError({ reset }: { reset: () => void }) {
  return (
    <main className="page-shell workspace-main" role="alert">
      <p className="eyebrow">WORKSPACE CONNECTION</p>
      <h1 className="workspace-title">Your workspace is temporarily unavailable.</h1>
      <p className="hero-description">
        We couldn’t reach the workspace service. Please try again in a moment.
      </p>
      <button className="primary-button" type="button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
