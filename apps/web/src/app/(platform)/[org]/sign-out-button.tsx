'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { apiBaseUrl } from '@/lib/api';
import styles from './workspace.module.css';

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  async function signOut() {
    if (pending) return;
    setPending(true);
    setError('');
    try {
      const supabase = createClient();
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (data.session) {
        const response = await fetch(`${apiBaseUrl}/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${data.session.access_token}` },
        });
        if (!response.ok && response.status !== 401) throw new Error('Session revocation failed.');
      }
      const { error: authError } = await supabase.auth.signOut({ scope: 'local' });
      if (authError) throw authError;
      router.replace('/login');
      router.refresh();
    } catch {
      setError('Couldn’t sign out. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button className={styles.signOut} type="button" disabled={pending} onClick={signOut}>
        {pending ? 'Signing out…' : 'Sign out'}
      </button>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
