import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  Post,
  Req,
  ValidationPipe,
} from '@nestjs/common';
import type { ServiceResponse } from '@opspilot/contracts';
import type { AuthenticatedRequest } from '../auth/supabase-auth.guard.js';
import { validationOptions } from '../validation.js';
import { CreateServiceDto } from './create-service.dto.js';
import { ServicesService } from './services.service.js';

const createServicePipe = new ValidationPipe({
  ...validationOptions,
  expectedType: CreateServiceDto,
});

@Controller('organizations/:orgSlug/services')
export class ServicesController {
  constructor(@Inject(ServicesService) private readonly services: ServicesService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  list(
    @Req() request: AuthenticatedRequest,
    @Param('orgSlug') orgSlug: string,
  ): Promise<ServiceResponse[]> {
    return this.services.list(request.user!.id, orgSlug);
  }

  @Post()
  @Header('Cache-Control', 'private, no-store')
  create(
    @Req() request: AuthenticatedRequest,
    @Param('orgSlug') orgSlug: string,
    @Body(createServicePipe) dto: CreateServiceDto,
  ): Promise<ServiceResponse> {
    return this.services.create(request.user!.id, orgSlug, dto);
  }
}
