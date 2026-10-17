'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { createClient } from '@/lib/supabase/client';

export function AuthForm({
  mode,
  confirmationError = false,
}: {
  mode: 'login' | 'signup';
  confirmationError?: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(
    confirmationError
      ? 'This confirmation link is invalid or expired. Sign in or request a new confirmation email.'
      : '',
  );
  const isSignup = mode === 'signup';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError('');
    setMessage('');
    try {
      const supabase = createClient();
      if (isSignup) {
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
          setMessage(
            'Check your email to confirm your account. Once confirmed, you can continue to your workspace.',
          );
          setPassword('');
          return;
        }
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (authError) {
          setError(authError.message);
          return;
        }
      }
      router.replace('/onboarding');
      router.refresh();
    } catch {
      setError('We couldn’t connect to sign-in. Please try again in a moment.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="form-stack" onSubmit={submit} aria-busy={pending}>
      <div className="form-field">
        <label htmlFor="email">Email address</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={320}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@company.com"
          disabled={pending}
        />
      </div>
      <div className="form-field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={isSignup ? 'new-password' : 'current-password'}
          required
          minLength={isSignup ? 12 : undefined}
          maxLength={128}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={pending}
          aria-describedby={isSignup ? 'password-hint' : undefined}
        />
        {isSignup && (
          <p id="password-hint" className="field-hint">
            Use at least 12 characters.
          </p>
        )}
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="form-success" role="status">
          {message}
        </p>
      )}
      <button className="form-submit" type="submit" disabled={pending}>
        {pending
          ? isSignup
            ? 'Creating account…'
            : 'Signing in…'
          : isSignup
            ? 'Create account'
            : 'Sign in'}
        <span aria-hidden="true">→</span>
      </button>
      <p className="auth-switch">
        {isSignup ? 'Already have an account?' : 'New to OpsPilot?'}{' '}
        <Link href={isSignup ? '/login' : '/signup'}>
          {isSignup ? 'Sign in' : 'Create an account'}
        </Link>
      </p>
    </form>
  );
}
