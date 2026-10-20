import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { HealthController } from './health.controller.js';
import { OrganizationsModule } from './organizations/organizations.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ServicesModule } from './services/services.module.js';

@Module({
  imports: [PrismaModule, AuthModule, OrganizationsModule, ServicesModule],
  controllers: [HealthController],
})
export class AppModule {}
