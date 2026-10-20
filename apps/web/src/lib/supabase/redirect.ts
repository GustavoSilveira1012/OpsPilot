import { NextResponse } from 'next/server';

// Relative destinations retain the browser's origin, including local IP addresses.
// Only these fixed destinations are accepted; query parameters cannot redirect users.
export function authRedirect(destination: '/onboarding' | '/login?error=confirmation') {
  return new NextResponse(null, {
    status: 303,
    headers: { Location: destination, 'Cache-Control': 'private, no-store' },
  });
}
