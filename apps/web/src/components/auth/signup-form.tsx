'use client';

import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { data, error: authError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (authError) {
        setError(authError.message);
        return;
      }
      if (!data.session) {
        setMessage('Check your email to confirm your account.');
        setPassword('');
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
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          disabled={isSubmitting}
          name="password"
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
        <small>At least 12 characters.</small>
      </label>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      {message ? (
        <p className="form-message" role="status">
          {message}
        </p>
      ) : null}

      <button className="primary-button" disabled={isSubmitting} type="submit">
        {isSubmitting ? 'Creating account…' : 'Create account'}
      </button>
    </form>
  );
}
