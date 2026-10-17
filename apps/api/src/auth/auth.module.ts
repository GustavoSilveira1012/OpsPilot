import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller.js';
import { SupabaseAuthGuard } from './supabase-auth.guard.js';

@Module({
  controllers: [AuthController],
  providers: [{ provide: APP_GUARD, useClass: SupabaseAuthGuard }],
})
export class AuthModule {}
