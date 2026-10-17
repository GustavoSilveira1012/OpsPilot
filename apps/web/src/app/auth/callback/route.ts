import type { NextRequest } from 'next/server';
import { authRedirect } from '@/lib/supabase/redirect';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return authRedirect('/onboarding');
    }
  }
  return authRedirect('/login?error=confirmation');
}
