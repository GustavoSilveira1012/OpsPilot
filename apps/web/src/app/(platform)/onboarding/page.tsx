import Link from 'next/link';
import type { Metadata } from 'next';
import { Brand } from '@/components/brand';
import { CreateWorkspaceForm } from '@/components/create-workspace-form';
import { SignOutButton } from '@/components/sign-out-button';
import { listOrganizations } from '@/lib/api/server';

export const metadata: Metadata = { title: 'Your workspaces | OpsPilot' };

export default async function OnboardingPage() {
  const organizations = await listOrganizations();
  return (
    <main className="onboarding-shell">
      <header className="platform-topbar">
        <Brand />
        <SignOutButton />
      </header>
      <div className="onboarding-grid">
        <section className="onboarding-intro" aria-labelledby="onboarding-title">
          <p className="eyebrow">A SHARED PLACE TO RESPOND</p>
          <h1 id="onboarding-title">
            Bring your team
            <br />
            into focus.
          </h1>
          <p>
            Your workspace connects your services, your people, and every step of an incident
            response.
          </p>
          {organizations.length > 0 && (
            <div className="workspace-list">
              <h2>Your workspaces</h2>
              {organizations.map((organization) => (
                <Link
                  className="workspace-link"
                  key={organization.id}
                  href={`/${organization.slug}/dashboard`}
                >
                  <span>
                    <strong>{organization.name}</strong>
                    <small>{organization.slug}</small>
                  </span>
                  <span aria-hidden="true">↗</span>
                </Link>
              ))}
            </div>
          )}
        </section>
        <section className="auth-card workspace-card" aria-labelledby="workspace-title">
          <p className="card-overline">YOUR NEXT CHAPTER</p>
          <h2 id="workspace-title">Create your workspace</h2>
          <p className="auth-description">Choose a name your team will recognize.</p>
          <CreateWorkspaceForm />
        </section>
      </div>
    </main>
  );
}
