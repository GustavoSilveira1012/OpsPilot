import type { NextRequest } from 'next/server';
import { authRedirect } from '@/lib/supabase/redirect';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get('token_hash');
  const type = request.nextUrl.searchParams.get('type');
  if (tokenHash && (type === 'email' || type === 'signup')) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return authRedirect('/onboarding');
  }
  return authRedirect('/login?error=confirmation');
}
