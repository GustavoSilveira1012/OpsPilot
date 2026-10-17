import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createRemoteJWKSet, errors, jwtVerify } from 'jose';
import { PrismaService } from '../prisma/prisma.service.js';
import { PUBLIC_ROUTE } from './auth.decorators.js';

export type AuthenticatedUser = { id: string; email: string | null; sessionId: string };
export type AuthenticatedRequest = {
  headers: { authorization?: string };
  user?: AuthenticatedUser;
};
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;
  private readonly issuer: string;

  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {
    const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
    if (!url) throw new Error('SUPABASE_URL is required.');
    const parsed = new URL(url);
    if (
      parsed.origin !== url ||
      (parsed.protocol !== 'https:' &&
        !(parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname)))
    )
      throw new Error('SUPABASE_URL must be an HTTPS origin (HTTP is allowed for localhost).');
    this.issuer = `${url}/auth/v1`;
    this.jwks = createRemoteJWKSet(new URL(`${this.issuer}/.well-known/jwks.json`));
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [
        context.getHandler(),
        context.getClass(),
      ])
    )
      return true;
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    if (!authorization || authorization.length > 16_384 || !/^Bearer [^\s,]+$/i.test(authorization))
      throw new UnauthorizedException('Missing or malformed bearer token.');
    let payload;
    try {
      ({ payload } = await jwtVerify(authorization.slice(7), this.jwks, {
        issuer: this.issuer,
        audience: 'authenticated',
        algorithms: ['ES256', 'RS256'],
        requiredClaims: ['sub', 'exp', 'session_id'],
      }));
    } catch (error: unknown) {
      if (
        error instanceof errors.JOSEError &&
        ![errors.JWKSTimeout.code, errors.JWKSInvalid.code, errors.JOSEError.code].includes(
          error.code,
        )
      )
        throw new UnauthorizedException('Invalid or expired access token.');
      throw new ServiceUnavailableException('Authentication is temporarily unavailable.');
    }
    if (
      !payload.sub ||
      !uuidPattern.test(payload.sub) ||
      payload.role !== 'authenticated' ||
      payload.is_anonymous === true ||
      typeof payload.session_id !== 'string' ||
      !uuidPattern.test(payload.session_id) ||
      typeof payload.exp !== 'number' ||
      !Number.isFinite(payload.exp)
    )
      throw new UnauthorizedException('Invalid authentication claims.');
    const revoked = await this.prisma.revokedSession.findUnique({
      where: { sessionId: payload.session_id },
      select: { sessionId: true },
    });
    if (revoked) throw new UnauthorizedException('This session has signed out.');
    request.user = {
      id: payload.sub,
      sessionId: payload.session_id,
      email: typeof payload.email === 'string' ? payload.email : null,
    };
    return true;
  }
}
