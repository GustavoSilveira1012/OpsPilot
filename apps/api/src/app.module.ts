import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { OrganizationsModule } from './organizations/organizations.module.js';

@Module({
  imports: [PrismaModule, AuthModule, OrganizationsModule],
  controllers: [HealthController],
})
export class AppModule {}
