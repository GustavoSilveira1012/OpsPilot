'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function LoginForm({ confirmationError = false }: { confirmationError?: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(
    confirmationError
      ? 'This confirmation link is invalid or expired. Please sign in or request another confirmation email.'
      : null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setError(null);
    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (authError) {
        setError(authError.message);
        return;
      }
      router.replace('/onboarding');
      router.refresh();
    } catch {
      setError('We couldn’t connect to sign-in. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form aria-busy={isSubmitting} className="auth-form" onSubmit={handleSubmit}>
      <label className="field">
        <span>Email</span>
        <input
          autoComplete="email"
          disabled={isSubmitting}
          maxLength={320}
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
      </label>

      <label className="field">
        <span>Password</span>
        <input
          autoComplete="current-password"
          disabled={isSubmitting}
          maxLength={128}
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
      </label>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <button className="primary-button" disabled={isSubmitting} type="submit">
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
