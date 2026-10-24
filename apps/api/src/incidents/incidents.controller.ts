import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  ValidationPipe,
} from '@nestjs/common';

import type {
  IncidentDetailResponse,
  IncidentListResponse,
  IncidentResponse,
} from '@opspilot/contracts';

import type { AuthenticatedRequest } from '../auth/supabase-auth.guard.js';
import { validationOptions } from '../validation.js';
import { CreateIncidentDto } from './create-incident.dto.js';
import { ListIncidentsDto } from './list-incidents.dto.js';
import { IncidentsService } from './incidents.service.js';

const createPipe = new ValidationPipe({
  ...validationOptions,
  expectedType: CreateIncidentDto,
});

const listPipe = new ValidationPipe({
  ...validationOptions,
  expectedType: ListIncidentsDto,
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
}
