import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { OrganizationSummary } from '@opspilot/contracts';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthIdentity } from '../auth/auth.types.js';
import type { CreateOrganizationDto } from './create-organization.dto.js';

const organizationSelect = { id: true, name: true, slug: true } as const;

@Injectable()
export class OrganizationsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(identity: AuthIdentity, input: CreateOrganizationDto): Promise<OrganizationSummary> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.upsert({
          where: { id: identity.id },
          update: { email: identity.email },
          create: { id: identity.id, email: identity.email },
        });
        if (user.deactivatedAt) throw new ForbiddenException('Your account is deactivated.');
        const organization = await tx.organization.create({
          data: {
            name: input.name,
            slug: input.slug,
            memberships: {
              create: { userId: user.id, role: 'OWNER', status: 'ACTIVE', joinedAt: new Date() },
            },
          },
          select: organizationSelect,
        });
        return { ...organization, role: 'OWNER' as const };
      });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('This workspace URL is already in use.');
      }
      throw error;
    }
  }

  async list(identity: AuthIdentity): Promise<OrganizationSummary[]> {
    const memberships = await this.prisma.membership.findMany({
      where: {
        userId: identity.id,
        status: 'ACTIVE',
        user: { deactivatedAt: null },
        organization: { archivedAt: null },
      },
      select: { role: true, organization: { select: organizationSelect } },
      orderBy: [{ organization: { name: 'asc' } }, { organizationId: 'asc' }],
    });
    return memberships.map(({ organization, role }) => ({ ...organization, role }));
  }

  async findForMember(identity: AuthIdentity, slug: string): Promise<OrganizationSummary> {
    const membership = await this.prisma.membership.findFirst({
      where: {
        userId: identity.id,
        status: 'ACTIVE',
        user: { deactivatedAt: null },
        organization: { slug, archivedAt: null },
      },
      select: { role: true, organization: { select: organizationSelect } },
    });
    if (!membership) throw new NotFoundException('Workspace not found.');
    return { ...membership.organization, role: membership.role };
  }
}
