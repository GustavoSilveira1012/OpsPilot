import { Body, Controller, Get, Header, Inject, Param, Post } from '@nestjs/common';
import type { OrganizationSummary } from '@opspilot/contracts';
import { CurrentUser } from '../auth/auth.decorators.js';
import type { AuthIdentity } from '../auth/auth.types.js';
import { CreateOrganizationDto } from './create-organization.dto.js';
import { OrganizationsService } from './organizations.service.js';

@Controller('organizations')
export class OrganizationsController {
  constructor(@Inject(OrganizationsService) private readonly organizations: OrganizationsService) {}

  @Post()
  @Header('Cache-Control', 'private, no-store')
  create(
    @CurrentUser() identity: AuthIdentity,
    @Body() input: CreateOrganizationDto,
  ): Promise<OrganizationSummary> {
    return this.organizations.create(identity, input);
  }

  @Get()
  @Header('Cache-Control', 'private, no-store')
  list(@CurrentUser() identity: AuthIdentity): Promise<OrganizationSummary[]> {
    return this.organizations.list(identity);
  }

  @Get(':slug')
  @Header('Cache-Control', 'private, no-store')
  find(
    @CurrentUser() identity: AuthIdentity,
    @Param('slug') slug: string,
  ): Promise<OrganizationSummary> {
    return this.organizations.findForMember(identity, slug);
  }
}
