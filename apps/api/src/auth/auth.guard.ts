import {
  Inject,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PUBLIC_ROUTE } from './auth.decorators.js';
import { SupabaseAuthService } from './supabase-auth.service.js';
import type { AuthenticatedRequest } from './auth.types.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(SupabaseAuthService) private readonly auth: SupabaseAuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (
      this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE, [
        context.getHandler(),
        context.getClass(),
      ])
    ) {
      return true;
    }
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const match = /^Bearer ([^\s,]+)$/i.exec(request.headers.authorization ?? '');
    if (!match || match[1].length > 16384) {
      throw new UnauthorizedException('A bearer access token is required.');
    }
    request.identity = await this.auth.verify(match[1]);
    return true;
  }
}
