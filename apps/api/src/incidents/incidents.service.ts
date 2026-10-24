import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import type {
  IncidentDetailResponse,
  IncidentListResponse,
  IncidentResponse,
} from '@opspilot/contracts';

import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateIncidentDto } from './create-incident.dto.js';
import type { ListIncidentsDto } from './list-incidents.dto.js';

const incidentFields = {
  id: true,
  number: true,
  title: true,
  summary: true,
  status: true,
  severity: true,
  serviceId: true,
  createdByUserId: true,
  startedAt: true,
  resolvedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

type IncidentRecord = Prisma.IncidentGetPayload<{
  select: typeof incidentFields;
}>;

function toResponse(incident: IncidentRecord): IncidentResponse {
  return {
    ...incident,
    startedAt: incident.startedAt.toISOString(),
    resolvedAt: incident.resolvedAt?.toISOString() ?? null,
    createdAt: incident.createdAt.toISOString(),
    updatedAt: incident.updatedAt.toISOString(),
  };
}

@Injectable()
export class IncidentsService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  private async membership(
    userId: string,
    orgSlug: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const membership = await client.membership.findFirst({
      where: {
        userId,
        status: 'ACTIVE',
        user: { deactivatedAt: null },
        organization: {
          slug: orgSlug,
          archivedAt: null,
        },
      },
      select: {
        organizationId: true,
        role: true,
      },
    });

    if (!membership) {
      throw new NotFoundException('Organization not found.');
    }

    return membership;
  }

  async create(userId: string, orgSlug: string, dto: CreateIncidentDto): Promise<IncidentResponse> {
    const incident = await this.prisma.$transaction(async (tx) => {
      const member = await this.membership(userId, orgSlug, tx);

      if (member.role !== 'OWNER' && member.role !== 'ADMIN') {
        throw new ForbiddenException('You cannot create incidents.');
      }

      if (dto.serviceId) {
        const service = await tx.service.findFirst({
          where: {
            id: dto.serviceId,
            organizationId: member.organizationId,
            archivedAt: null,
          },
          select: { id: true },
        });

        if (!service) {
          throw new NotFoundException('Service not found.');
        }
      }

      // PostgreSQL serializes updates to this row.
      // The old counter value becomes the incident number.
      const organization = await tx.organization.update({
        where: {
          id: member.organizationId,
          archivedAt: null,
        },
        data: {
          nextIncidentNumber: {
            increment: 1,
          },
        },
        select: {
          nextIncidentNumber: true,
        },
      });

      const created = await tx.incident.create({
        data: {
          organizationId: member.organizationId,
          number: organization.nextIncidentNumber - 1,
          title: dto.title,
          summary: dto.summary ?? null,
          severity: dto.severity ?? 'SEV3',
          serviceId: dto.serviceId ?? null,
          createdByUserId: userId,
        },
        select: incidentFields,
      });

      await tx.incidentEvent.create({
        data: {
          organizationId: member.organizationId,
          incidentId: created.id,
          actorUserId: userId,
          type: 'INCIDENT_CREATED',
          details: {
            status: created.status,
            severity: created.severity,
            serviceId: created.serviceId,
          },
        },
      });

      return created;
    });

    return toResponse(incident);
  }

  async list(
    userId: string,
    orgSlug: string,
    filters: ListIncidentsDto,
  ): Promise<IncidentListResponse> {
    const member = await this.membership(userId, orgSlug);

    const where: Prisma.IncidentWhereInput = {
      organizationId: member.organizationId,
      status: filters.status,
      severity: filters.severity,
      serviceId: filters.serviceId,
    };

    const [incidents, total] = await Promise.all([
      this.prisma.incident.findMany({
        where,
        select: incidentFields,
        orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
        skip: filters.offset ?? 0,
        take: filters.limit ?? 25,
      }),
      this.prisma.incident.count({ where }),
    ]);

    return {
      items: incidents.map(toResponse),
      total,
    };
  }

  async getById(
    userId: string,
    orgSlug: string,
    incidentId: string,
  ): Promise<IncidentDetailResponse> {
    const member = await this.membership(userId, orgSlug);

    const incident = await this.prisma.incident.findFirst({
      where: {
        id: incidentId,
        organizationId: member.organizationId,
      },
      select: {
        ...incidentFields,
        events: {
          select: {
            id: true,
            type: true,
            actorUserId: true,
            message: true,
            details: true,
            occurredAt: true,
          },
          orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
        },
      },
    });

    if (!incident) {
      throw new NotFoundException('Incident not found.');
    }

    return {
      ...toResponse(incident),
      timeline: incident.events.map((event) => ({
        id: event.id,
        type: event.type,
        actorUserId: event.actorUserId,
        message: event.message,
        details: event.details,
        occurredAt: event.occurredAt.toISOString(),
      })),
    };
  }
}
