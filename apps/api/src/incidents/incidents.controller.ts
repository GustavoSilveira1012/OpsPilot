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
  Put,
  Query,
  Req,
  ValidationPipe,
} from '@nestjs/common';

import type {
  IncidentDetailResponse,
  IncidentListResponse,
  IncidentResponderResponse,
  IncidentResponse,
} from '@opspilot/contracts';

import type { AuthenticatedRequest } from '../auth/supabase-auth.guard.js';
import { validationOptions } from '../validation.js';
import { CreateIncidentDto } from './create-incident.dto.js';
import { ListIncidentsDto } from './list-incidents.dto.js';
import { IncidentsService } from './incidents.service.js';
import { UpdateIncidentDto } from './update-incident.dto.js';

const createPipe = new ValidationPipe({
  ...validationOptions,
  expectedType: CreateIncidentDto,
});

const listPipe = new ValidationPipe({
  ...validationOptions,
  expectedType: ListIncidentsDto,
});

const updatePipe = new ValidationPipe({
  ...validationOptions,
  expectedType: UpdateIncidentDto,
});

@Controller('organizations/:orgSlug/incidents')
export class IncidentsController {
  constructor(
    @Inject(IncidentsService)
    private readonly incidents: IncidentsService,
  ) {}

  @Post()
  @Header('Cache-Control', 'private, no-store')
  create(
    @Req() request: AuthenticatedRequest,
    @Param('orgSlug') orgSlug: string,
    @Body(createPipe) dto: CreateIncidentDto,
  ): Promise<IncidentResponse> {
    return this.incidents.create(request.user!.id, orgSlug, dto);
  }

  @Get()
  @Header('Cache-Control', 'private, no-store')
  list(
    @Req() request: AuthenticatedRequest,
    @Param('orgSlug') orgSlug: string,
    @Query(listPipe) filters: ListIncidentsDto,
  ): Promise<IncidentListResponse> {
    return this.incidents.list(request.user!.id, orgSlug, filters);
  }

  @Get(':id')
  @Header('Cache-Control', 'private, no-store')
  getById(
    @Req() request: AuthenticatedRequest,
    @Param('orgSlug') orgSlug: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<IncidentDetailResponse> {
    return this.incidents.getById(request.user!.id, orgSlug, id);
  }

  @Patch(':id')
  @Header('Cache-Control', 'private, no-store')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('orgSlug') orgSlug: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(updatePipe) dto: UpdateIncidentDto,
  ): Promise<IncidentResponse> {
    return this.incidents.update(request.user!.id, orgSlug, id, dto);
  }

  @Get(':id/responders')
  listResponders(
    @Req() request: AuthenticatedRequest,
    @Param('orgSlug') orgSlug: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<IncidentResponderResponse[]> {
    return this.incidents.listResponders(request.user!.id, orgSlug, id);
  }

  @Put(':id/responders/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async assignResponder(
    @Req() request: AuthenticatedRequest,
    @Param('orgSlug') orgSlug: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('userId', new ParseUUIDPipe()) targetUserId: string,
  ): Promise<void> {
    await this.incidents.assignResponder(request.user!.id, orgSlug, id, targetUserId);
  }

  @Delete(':id/responders/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeResponder(
    @Req() request: AuthenticatedRequest,
    @Param('orgSlug') orgSlug: string,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Param('userId', new ParseUUIDPipe()) targetUserId: string,
  ): Promise<void> {
    await this.incidents.removeResponder(request.user!.id, orgSlug, id, targetUserId);
  }
}
