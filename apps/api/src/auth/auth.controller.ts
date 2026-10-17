import { Controller, HttpCode, Inject, Post } from '@nestjs/common';
import { CurrentUser } from './auth.decorators.js';
import type { AuthIdentity } from './auth.types.js';
import { SupabaseAuthService } from './supabase-auth.service.js';

@Controller('auth')
export class AuthController {
  constructor(@Inject(SupabaseAuthService) private readonly auth: SupabaseAuthService) {}

  @Post('logout')
  @HttpCode(204)
  async logout(@CurrentUser() identity: AuthIdentity): Promise<void> {
    await this.auth.revoke(identity);
  }
}
