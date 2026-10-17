import type { Metadata } from 'next';
import Link from 'next/link';
import { listOrganizationMemberships } from '@/lib/organizations';
import { SignOutButton } from '../[org]/sign-out-button';
import { AuthShell } from '@/components/auth/auth-shell';
import { OnboardingForm } from '@/components/onboarding-form';

export const metadata: Metadata = {
  title: 'Create your workspace | OpsPilot',
};

export default async function OnboardingPage() {
  const memberships = await listOrganizationMemberships();
  return (
    <AuthShell
      description="Name your organization and choose the URL your team will use."
      eyebrow="Organization onboarding"
      title="Create your workspace"
    >
      <div className="onboarding-session">
        <SignOutButton />
      </div>
      {memberships.length > 0 && (
        <section className="existing-workspaces" aria-labelledby="existing-workspaces-title">
          <h2 id="existing-workspaces-title">Your workspaces</h2>
          <ul>
            {memberships.map(({ organization, role }) => (
              <li key={organization.id}>
                <Link href={`/${organization.slug}/dashboard`}>
                  <strong>{organization.name}</strong>
                  <span>{role.toLowerCase()} →</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <OnboardingForm />
    </AuthShell>
  );
}
