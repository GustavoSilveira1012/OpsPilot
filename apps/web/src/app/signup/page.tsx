import type { Metadata } from 'next';
import { AuthForm } from '@/components/auth-form';
import { Brand } from '@/components/brand';

export const metadata: Metadata = { title: 'Create account | OpsPilot' };

export default function SignupPage() {
  return (
    <main className="auth-shell">
      <div className="auth-brand">
        <Brand />
      </div>
      <section className="auth-card" aria-labelledby="auth-title">
        <p className="eyebrow">START WITH CLARITY</p>
        <h1 id="auth-title">Create your account.</h1>
        <p className="auth-description">
          One place to coordinate incidents, ownership, and the work ahead.
        </p>
        <AuthForm mode="signup" />
      </section>
      <p className="auth-footer">Built for resilient engineering teams.</p>
    </main>
  );
}
