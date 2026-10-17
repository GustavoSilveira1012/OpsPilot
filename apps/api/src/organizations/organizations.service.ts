import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { OrganizationMembershipResponse, OrganizationSummary } from '@opspilot/contracts';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../auth/supabase-auth.guard.js';
import {
  type CreateOrganizationDto,
  ORGANIZATION_SLUG_PATTERN,
} from './create-organization.dto.js';

const organizationSummary = { id: true, name: true, slug: true } as const;

@Injectable()
export class OrganizationsService {
  // Explicit token: a type-only PrismaService import would leave DI metadata as Object.
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(user: AuthenticatedUser, dto: CreateOrganizationDto): Promise<OrganizationSummary> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const profile = await tx.user.upsert({
          where: { id: user.id },
          create: { id: user.id, email: user.email },
          update: { email: user.email },
        });
        if (profile.deactivatedAt) throw new ForbiddenException('Your account is deactivated.');

        return tx.organization.create({
          data: {
            name: dto.name,
            slug: dto.slug,
            memberships: {
              create: {
                userId: user.id,
                role: 'OWNER',
                status: 'ACTIVE',
                joinedAt: new Date(),
              },
            },
          },
          select: organizationSummary,
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Organization slug is already taken.');
      }

      throw error;
    }
  }

  async listForUser(userId: string): Promise<OrganizationMembershipResponse[]> {
    return this.prisma.membership.findMany({
      where: {
        userId,
        status: 'ACTIVE',
        user: { deactivatedAt: null },
        organization: { archivedAt: null },
      },
      select: { role: true, organization: { select: organizationSummary } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Resolves the caller's ACTIVE membership in the organization identified by slug.
   * Missing organizations and missing memberships both return 404 so that slugs
   * belonging to other tenants are not disclosed.
   */
  async getMembership(userId: string, slug: string): Promise<OrganizationMembershipResponse> {
    const membership =
      slug.length >= 3 && slug.length <= 80 && ORGANIZATION_SLUG_PATTERN.test(slug)
        ? await this.prisma.membership.findFirst({
            where: {
              userId,
              status: 'ACTIVE',
              user: { deactivatedAt: null },
              organization: { slug, archivedAt: null },
            },
            select: { role: true, organization: { select: organizationSummary } },
          })
        : null;

    if (!membership) {
      throw new NotFoundException('Organization not found.');
    }

    return membership;
  }
}
