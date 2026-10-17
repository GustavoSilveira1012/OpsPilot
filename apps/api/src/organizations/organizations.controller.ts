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
import type { OrganizationMembershipResponse, OrganizationSummary } from '@opspilot/contracts';
import type { AuthenticatedRequest, AuthenticatedUser } from '../auth/supabase-auth.guard.js';
import { validationOptions } from '../validation.js';
import { CreateOrganizationDto } from './create-organization.dto.js';
import { OrganizationsService } from './organizations.service.js';

// consistent-type-imports + verbatimModuleSyntax erase type-only imports, which leaves
// decorator metadata as `Object`. Passing classes explicitly (@Inject, expectedType)
// keeps DI and body validation working without relying on emitted metadata.
const createOrganizationPipe = new ValidationPipe({
  ...validationOptions,
  expectedType: CreateOrganizationDto,
});

function currentUser(request: AuthenticatedRequest): AuthenticatedUser {
  // SupabaseAuthGuard always sets request.user before a handler runs.
  return request.user as AuthenticatedUser;
}

@Controller('organizations')
export class OrganizationsController {
  constructor(@Inject(OrganizationsService) private readonly organizations: OrganizationsService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  list(@Req() request: AuthenticatedRequest): Promise<OrganizationMembershipResponse[]> {
    return this.organizations.listForUser(currentUser(request).id);
  }

  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Body(createOrganizationPipe) dto: CreateOrganizationDto,
  ): Promise<OrganizationSummary> {
    return this.organizations.create(currentUser(request), dto);
  }

  @Get(':slug/membership')
  @Header('Cache-Control', 'private, no-store')
  membership(
    @Req() request: AuthenticatedRequest,
    @Param('slug') slug: string,
  ): Promise<OrganizationMembershipResponse> {
    return this.organizations.getMembership(currentUser(request).id, slug);
  }
}
