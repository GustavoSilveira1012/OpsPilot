import { Controller, HttpCode, Inject, Post } from '@nestjs/common';
import { CurrentUser } from './auth.decorators.js';
import type { AuthenticatedUser } from './supabase-auth.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Controller('auth')
export class AuthController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Post('logout')
  @HttpCode(204)
  async logout(@CurrentUser() identity: AuthenticatedUser): Promise<void> {
    await this.prisma.revokedSession.upsert({
      where: { sessionId: identity.sessionId },
      create: { sessionId: identity.sessionId, userId: identity.id },
      update: {},
    });
  }
}
