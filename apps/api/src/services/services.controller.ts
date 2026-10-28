import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  ValidationPipe,
  Put,
} from '@nestjs/common';
import type { ServiceOwnerResponse, ServiceResponse } from '@opspilot/contracts';
import type { AuthenticatedRequest } from '../auth/supabase-auth.guard.js';
import { validationOptions } from '../validation.js';
import { CreateServiceDto } from './create-service.dto.js';
import { ServicesService } from './services.service.js';
import { UpdateServiceDto } from './update-service.dto.js';

const createServicePipe = new ValidationPipe({
  ...validationOptions,
  expectedType: CreateServiceDto,
});

const updateServicePipe = new ValidationPipe({
  ...validationOptions,
  expectedType: UpdateServiceDto,
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

  @Get(':id')
  @Header('Cache-Control', 'private, no-store')
  getById(
    @Req() request: AuthenticatedRequest,
    @Param('orgSlug') orgSlug: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ServiceResponse> {
    return this.services.getById(request.user!.id, orgSlug, id);
  }

  @Patch(':id')
  @Header('Cache-Control', 'private, no-store')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('orgSlug') orgSlug: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(updateServicePipe) dto: UpdateServiceDto,
  ): Promise<ServiceResponse> {
    return this.services.update(request.user!.id, orgSlug, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async archive(
    @Req() request: AuthenticatedRequest,
    @Param('orgSlug') orgSlug: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    await this.services.archive(request.user!.id, orgSlug, id);
  }

  @Get(':id/owners')
  @Header('Cache-Control', 'private, no-store')
  listOwners(
    @Req() request: AuthenticatedRequest,
    @Param('orgSlug') orgSlug: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<ServiceOwnerResponse[]> {
    return this.services.listOwners(request.user!.id, orgSlug, id);
  }

  @Put(':id/owners/:userId')
  @Header('Cache-Control', 'private, no-store')
  @HttpCode(HttpStatus.NO_CONTENT)
  async assignOwner(
    @Req() request: AuthenticatedRequest,
    @Param('orgSlug') orgSlug: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('userId', new ParseUUIDPipe()) targetUserId: string,
  ): Promise<void> {
    await this.services.assignOwner(request.user!.id, orgSlug, id, targetUserId);
  }

  @Delete(':id/owners/:userId')
  @Header('Cache-Control', 'private, no-store')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeOwner(
    @Req() request: AuthenticatedRequest,
    @Param('orgSlug') orgSlug: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('userId', new ParseUUIDPipe()) targetUserId: string,
  ): Promise<void> {
    await this.services.removeOwner(request.user!.id, orgSlug, id, targetUserId);
  }
}
