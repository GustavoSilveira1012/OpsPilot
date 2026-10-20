import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ServiceOwnerResponse, ServiceResponse } from '@opspilot/contracts';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateServiceDto } from './create-service.dto.js';
import type { UpdateServiceDto } from './update-service.dto.js';

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

  async getById(userId: string, orgSlug: string, serviceId: string): Promise<ServiceResponse> {
    const membership = await this.findActiveMembership(userId, orgSlug);

    const service = await this.prisma.service.findFirst({
      where: {
        id: serviceId,
        organizationId: membership.organizationId,
        archivedAt: null,
      },
      select: serviceFields,
    });

    if (!service) {
      throw new NotFoundException('Service not found.');
    }

    return toResponse(service);
  }

  async update(
    userId: string,
    orgSlug: string,
    serviceId: string,
    dto: UpdateServiceDto,
  ): Promise<ServiceResponse> {
    if (Object.values(dto).every((value) => value === undefined)) {
      throw new BadRequestException('At least one field must be provided.');
    }

    const updatedService = await this.prisma.$transaction(async (tx) => {
      const membership = await this.findActiveMembership(userId, orgSlug, tx);

      if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
        throw new ForbiddenException('You cannot edit services.');
      }

      const result = await tx.service.updateMany({
        where: {
          id: serviceId,
          organizationId: membership.organizationId,
          archivedAt: null,
        },
        data: {
          name: dto.name,
          description: dto.description,
          tier: dto.tier,
          status: dto.status,
          runbookUrl: dto.runbookUrl,
        },
      });

      if (result.count === 0) {
        throw new NotFoundException('Service not found.');
      }

      const service = await tx.service.findFirst({
        where: {
          id: serviceId,
          organizationId: membership.organizationId,
          archivedAt: null,
        },
        select: serviceFields,
      });

      if (!service) {
        throw new NotFoundException('Service not found.');
      }

      return service;
    });

    return toResponse(updatedService);
  }

  async archive(userId: string, orgSlug: string, serviceId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const membership = await this.findActiveMembership(userId, orgSlug, tx);

      if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
        throw new ForbiddenException('You cannot archive services.');
      }

      const result = await tx.service.updateMany({
        where: {
          id: serviceId,
          organizationId: membership.organizationId,
          archivedAt: null,
        },
        data: {
          archivedAt: new Date(),
        },
      });

      if (result.count === 0) {
        throw new NotFoundException('Service not found.');
      }
    });
  }

  async listOwners(
    userId: string,
    orgSlug: string,
    serviceId: string,
  ): Promise<ServiceOwnerResponse[]> {
    const membership = await this.findActiveMembership(userId, orgSlug);

    await this.assertServiceExists(membership.organizationId, serviceId);

    const owners = await this.prisma.serviceOwnership.findMany({
      where: {
        organizationId: membership.organizationId,
        serviceId,
      },
      select: {
        userId: true,
        createdAt: true,
        membership: {
          select: {
            role: true,
            user: {
              select: {
                displayName: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return owners.map((owner) => ({
      userId: owner.userId,
      displayName: owner.membership.user.displayName,
      email: owner.membership.user.email,
      role: owner.membership.role,
      assignedAt: owner.createdAt.toISOString(),
    }));
  }

  async assignOwner(
    userId: string,
    orgSlug: string,
    serviceId: string,
    targetUserId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const membership = await this.findActiveMembership(userId, orgSlug, tx);

      if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
        throw new ForbiddenException('You cannot manage service owners.');
      }

      await this.assertServiceExists(membership.organizationId, serviceId, tx);

      const target = await tx.membership.findFirst({
        where: {
          organizationId: membership.organizationId,
          userId: targetUserId,
          status: 'ACTIVE',
          user: {
            deactivatedAt: null,
          },
        },
        select: {
          userId: true,
        },
      });

      if (!target) {
        throw new NotFoundException('Active organization member not found.');
      }

      await tx.serviceOwnership.upsert({
        where: {
          organizationId_serviceId_userId: {
            organizationId: membership.organizationId,
            serviceId,
            userId: targetUserId,
          },
        },
        create: {
          organizationId: membership.organizationId,
          serviceId,
          userId: targetUserId,
        },
        update: {},
      });
    });
  }

  async removeOwner(
    userId: string,
    orgSlug: string,
    serviceId: string,
    targetUserId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const membership = await this.findActiveMembership(userId, orgSlug, tx);

      if (membership.role !== 'OWNER' && membership.role !== 'ADMIN') {
        throw new ForbiddenException('You cannot manage service owners.');
      }

      await this.assertServiceExists(membership.organizationId, serviceId, tx);

      await tx.serviceOwnership.deleteMany({
        where: {
          organizationId: membership.organizationId,
          serviceId,
          userId: targetUserId,
        },
      });
    });
  }

  private async assertServiceExists(
    organizationId: string,
    serviceId: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<void> {
    const service = await client.service.findFirst({
      where: {
        id: serviceId,
        organizationId,
        archivedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (!service) {
      throw new NotFoundException('Service not found.');
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
