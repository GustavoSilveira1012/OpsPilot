import type { Metadata } from 'next';
import { AuthForm } from '@/components/auth-form';
import { Brand } from '@/components/brand';

export const metadata: Metadata = { title: 'Sign in | OpsPilot' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="auth-shell">
      <div className="auth-brand">
        <Brand />
      </div>
      <section className="auth-card" aria-labelledby="auth-title">
        <p className="eyebrow">YOUR RESPONSE WORKSPACE</p>
        <h1 id="auth-title">Welcome back.</h1>
        <p className="auth-description">Sign in to keep your team’s response moving.</p>
        <AuthForm mode="login" confirmationError={error === 'confirmation'} />
      </section>
      <p className="auth-footer">A clearer path through the unexpected.</p>
    </main>
  );
}
