import {
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createClient, isAuthError, type SupabaseClient } from '@supabase/supabase-js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthIdentity } from './auth.types.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class SupabaseAuthService {
  private readonly client: SupabaseClient;
  private readonly issuer: string;

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {
    const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
    const key = process.env.SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key?.startsWith('sb_publishable_')) {
      throw new Error('SUPABASE_URL and a SUPABASE_PUBLISHABLE_KEY are required.');
    }
    const parsed = new URL(url);
    if (
      parsed.origin !== url ||
      (parsed.protocol !== 'https:' &&
        !(parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname)))
    ) {
      throw new Error('SUPABASE_URL must be an HTTPS origin (HTTP is allowed for localhost).');
    }
    this.issuer = `${url}/auth/v1`;
    this.client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }

  async verify(token: string): Promise<AuthIdentity> {
    let result: Awaited<ReturnType<SupabaseClient['auth']['getClaims']>>;
    try {
      result = await this.client.auth.getClaims(token);
    } catch (error: unknown) {
      if (isAuthError(error) && error.name !== 'AuthRetryableFetchError') {
        throw new UnauthorizedException('Invalid or expired access token.');
      }
      throw new ServiceUnavailableException('Authentication is temporarily unavailable.');
    }
    if (result.error) {
      if (result.error.name === 'AuthRetryableFetchError' || (result.error.status ?? 0) >= 500) {
        throw new ServiceUnavailableException('Authentication is temporarily unavailable.');
      }
      throw new UnauthorizedException('Invalid or expired access token.');
    }
    const claims = result.data?.claims;
    const audience = claims?.aud;
    if (
      !claims ||
      claims.iss !== this.issuer ||
      !(
        audience === 'authenticated' ||
        (Array.isArray(audience) && audience.includes('authenticated'))
      ) ||
      claims.role !== 'authenticated' ||
      claims.is_anonymous === true ||
      !uuidPattern.test(claims.sub) ||
      typeof claims.session_id !== 'string' ||
      !uuidPattern.test(claims.session_id) ||
      !Number.isFinite(claims.exp) ||
      (claims.nbf !== undefined &&
        (typeof claims.nbf !== 'number' ||
          !Number.isFinite(claims.nbf) ||
          claims.nbf * 1000 > Date.now())) ||
      claims.exp * 1000 <= Date.now()
    ) {
      throw new UnauthorizedException('Invalid or expired access token.');
    }
    const revoked = await this.prisma.revokedSession.findUnique({
      where: { sessionId: claims.session_id as string },
      select: { sessionId: true },
    });
    if (revoked) throw new UnauthorizedException('This session has signed out.');
    return {
      id: claims.sub,
      sessionId: claims.session_id as string,
      email: typeof claims.email === 'string' ? claims.email : null,
    };
  }

  async revoke(identity: AuthIdentity): Promise<void> {
    await this.prisma.revokedSession.upsert({
      where: { sessionId: identity.sessionId },
      create: { sessionId: identity.sessionId, userId: identity.id },
      update: {},
    });
  }
}
