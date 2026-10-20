import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthShell } from '@/components/auth/auth-shell';
import { LoginForm } from '@/components/auth/login-form';

export const metadata: Metadata = {
  title: 'Sign in | OpsPilot',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <AuthShell
      description="Use your email and password to continue to your workspace."
      eyebrow="Welcome back"
      footer={
        <>
          New to OpsPilot? <Link href="/signup">Create an account</Link>
        </>
      }
      title="Sign in"
    >
      <LoginForm confirmationError={error === 'confirmation'} />
    </AuthShell>
  );
}
