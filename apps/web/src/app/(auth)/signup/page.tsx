import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthShell } from '@/components/auth/auth-shell';
import { SignupForm } from '@/components/auth/signup-form';

export const metadata: Metadata = {
  title: 'Create account | OpsPilot',
};

export default function SignupPage() {
  return (
    <AuthShell
      description="Create an account with your email and password, then set up your workspace."
      eyebrow="Get started"
      footer={
        <>
          Already have an account? <Link href="/login">Sign in</Link>
        </>
      }
      title="Create your account"
    >
      <SignupForm />
    </AuthShell>
  );
}
