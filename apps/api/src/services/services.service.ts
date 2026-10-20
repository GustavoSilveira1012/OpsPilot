import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ServiceResponse } from '@opspilot/contracts';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateServiceDto } from './create-service.dto.js';

const serviceFields = {
  id: true,
  name: true,
  slug: true,
  description: true,
  tier: true,
  status: true,
  runbookUrl: true,
  createdAt: true,
  updatedAt: true,
} as const;

function toResponse(
  service: Omit<
    Prisma.ServiceGetPayload<{ select: typeof serviceFields }>,
    'createdAt' | 'updatedAt'
  > & {
    createdAt: Date;
    updatedAt: Date;
  },
): ServiceResponse {
  return {
    ...service,
    createdAt: service.createdAt.toISOString(),
    updatedAt: service.updatedAt.toISOString(),
  };
}

@Injectable()
export class ServicesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(userId: string, orgSlug: string): Promise<ServiceResponse[]> {
    const membership = await this.findActiveMembership(userId, orgSlug);
    const services = await this.prisma.service.findMany({
      where: { organizationId: membership.organizationId, archivedAt: null },
      select: serviceFields,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    return services.map(toResponse);
  }

  async create(userId: string, orgSlug: string, dto: CreateServiceDto): Promise<ServiceResponse> {
    try {
      const service = await this.prisma.$transaction(async (tx) => {
        const membership = await this.findActiveMembership(userId, orgSlug, tx);
        if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
          throw new ForbiddenException('You do not have permission to create services.');
        }

        return tx.service.create({
          data: {
            organizationId: membership.organizationId,
            name: dto.name,
            slug: dto.slug,
            description: dto.description ?? null,
            tier: dto.tier,
            runbookUrl: dto.runbookUrl ?? null,
          },
          select: serviceFields,
        });
      });

      return toResponse(service);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Service slug is already used in this workspace.');
      }

      throw error;
    }
  }

  private async findActiveMembership(
    userId: string,
    orgSlug: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const membership = await client.membership.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        user: { deactivatedAt: null },
        organization: { slug: orgSlug, archivedAt: null },
      },
      select: { organizationId: true, role: true },
    });

    if (!membership) throw new NotFoundException('Organization not found.');
    return membership;
  }
}
