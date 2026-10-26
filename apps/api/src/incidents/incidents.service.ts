import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import type {
  IncidentDetailResponse,
  IncidentListResponse,
  IncidentResponderResponse,
  IncidentResponse,
} from '@opspilot/contracts';

import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateIncidentDto } from './create-incident.dto.js';
import type { ListIncidentsDto } from './list-incidents.dto.js';
import type { UpdateIncidentDto } from './update-incident.dto.js';

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

  private async lockIncident(
    organizationId: string,
    incidentId: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`
      SELECT id
      FROM incidents
      WHERE id = ${incidentId}::uuid
        AND organization_id = ${organizationId}::uuid
      FOR UPDATE
    `,
    );

    if (rows.length === 0) {
      throw new NotFoundException('Incident not found.');
    }
  }

  async listResponders(
    userId: string,
    orgSlug: string,
    incidentId: string,
  ): Promise<IncidentResponderResponse[]> {
    const member = await this.membership(userId, orgSlug);

    const incident = await this.prisma.incident.findFirst({
      where: {
        id: incidentId,
        organizationId: member.organizationId,
      },
      select: { id: true },
    });

    if (!incident) {
      throw new NotFoundException('Incident not found.');
    }

    const responders = await this.prisma.incidentResponder.findMany({
      where: {
        organizationId: member.organizationId,
        incidentId,
        removedAt: null,
        responder: {
          status: 'ACTIVE',
          user: { deactivatedAt: null },
        },
      },
      select: {
        userId: true,
        assignedAt: true,
        assignedByUserId: true,
        responder: {
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
      orderBy: [{ assignedAt: 'asc' }, { userId: 'asc' }],
    });

    return responders.map((responder) => ({
      userId: responder.userId,
      displayName: responder.responder.user.displayName,
      email: responder.responder.user.email,
      role: responder.responder.role,
      assignedAt: responder.assignedAt.toISOString(),
      assignedByUserId: responder.assignedByUserId,
    }));
  }

  async assignResponder(
    userId: string,
    orgSlug: string,
    incidentId: string,
    targetUserId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const member = await this.membership(userId, orgSlug, tx);

      if (member.role !== 'OWNER' && member.role !== 'ADMIN') {
        throw new ForbiddenException('You cannot manage incident responders.');
      }

      await this.lockIncident(member.organizationId, incidentId, tx);

      const target = await tx.membership.findFirst({
        where: {
          organizationId: member.organizationId,
          userId: targetUserId,
          status: 'ACTIVE',
          user: { deactivatedAt: null },
        },
        select: { userId: true },
      });

      if (!target) {
        throw new NotFoundException('Active organization member not found.');
      }

      const key = {
        organizationId: member.organizationId,
        incidentId,
        userId: targetUserId,
      };

      const existing = await tx.incidentResponder.findUnique({
        where: {
          organizationId_incidentId_userId: key,
        },
      });

      // Assigning an active responder twice is a no-op.
      if (existing && existing.removedAt === null) return;

      const now = new Date();

      await tx.incidentResponder.upsert({
        where: {
          organizationId_incidentId_userId: key,
        },
        create: {
          ...key,
          assignedByUserId: userId,
          assignedAt: now,
        },
        update: {
          removedAt: null,
          assignedByUserId: userId,
          assignedAt: now,
        },
      });

      await tx.incidentEvent.create({
        data: {
          organizationId: member.organizationId,
          incidentId,
          actorUserId: userId,
          type: 'RESPONDER_ASSIGNED',
          details: {
            userId: targetUserId,
          },
        },
      });
    });
  }

  async removeResponder(
    userId: string,
    orgSlug: string,
    incidentId: string,
    targetUserId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const member = await this.membership(userId, orgSlug, tx);

      if (member.role !== 'OWNER' && member.role !== 'ADMIN') {
        throw new ForbiddenException('You cannot manage incident responders.');
      }

      await this.lockIncident(member.organizationId, incidentId, tx);

      const result = await tx.incidentResponder.updateMany({
        where: {
          organizationId: member.organizationId,
          incidentId,
          userId: targetUserId,
          removedAt: null,
        },
        data: {
          removedAt: new Date(),
        },
      });

      // Removing an absent responder is also idempotent.
      if (result.count === 0) return;

      await tx.incidentEvent.create({
        data: {
          organizationId: member.organizationId,
          incidentId,
          actorUserId: userId,
          type: 'RESPONDER_REMOVED',
          details: {
            userId: targetUserId,
          },
        },
      });
    });
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

  async update(
    userId: string,
    orgSlug: string,
    incidentId: string,
    dto: UpdateIncidentDto,
  ): Promise<IncidentResponse> {
    return this.prisma.$transaction(async (tx) => {
      const member = await this.membership(userId, orgSlug, tx);

      if (member.role !== 'OWNER' && member.role !== 'ADMIN') {
        throw new ForbiddenException('You cannot update incidents.');
      }

      await this.lockIncident(member.organizationId, incidentId, tx);

      const current = await tx.incident.findFirst({
        where: {
          id: incidentId,
          organizationId: member.organizationId,
        },
        select: incidentFields,
      });

      if (!current) {
        throw new NotFoundException('Incident not found.');
      }

      const statusChanged = dto.status !== undefined && dto.status !== current.status;
      const severityChanged = dto.severity !== undefined && dto.severity !== current.severity;
      const summaryChanged = dto.summary !== undefined && dto.summary !== current.summary;
      const serviceChanged = dto.serviceId !== undefined && dto.serviceId !== current.serviceId;

      if (serviceChanged && dto.serviceId) {
        const services = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
          SELECT id
          FROM services
          WHERE id = ${dto.serviceId}::uuid
            AND organization_id = ${member.organizationId}::uuid
            AND archived_at IS NULL
          FOR UPDATE
        `);

        if (services.length === 0) {
          throw new NotFoundException('Service not found.');
        }
      }

      if (!statusChanged && !severityChanged && !summaryChanged && !serviceChanged) {
        return toResponse(current);
      }

      const now = new Date();
      const events: Prisma.IncidentEventCreateManyInput[] = [];

      if (statusChanged) {
        events.push({
          organizationId: member.organizationId,
          incidentId,
          actorUserId: userId,
          type: 'STATUS_CHANGED',
          occurredAt: now,
          details: {
            from: current.status,
            to: dto.status!,
          },
        });
      }

      if (severityChanged) {
        events.push({
          organizationId: member.organizationId,
          incidentId,
          actorUserId: userId,
          type: 'SEVERITY_CHANGED',
          occurredAt: now,
          details: {
            from: current.severity,
            to: dto.severity!,
          },
        });
      }

      if (summaryChanged) {
        events.push({
          organizationId: member.organizationId,
          incidentId,
          actorUserId: userId,
          type: 'DESCRIPTION_UPDATED',
          occurredAt: now,
          details: {
            summary: dto.summary,
          },
        });
      }

      if (serviceChanged) {
        if (current.serviceId) {
          events.push({
            organizationId: member.organizationId,
            incidentId,
            actorUserId: userId,
            type: 'SERVICE_UNLINKED',
            occurredAt: now,
            details: {
              serviceId: current.serviceId,
            },
          });
        }

        if (dto.serviceId) {
          events.push({
            organizationId: member.organizationId,
            incidentId,
            actorUserId: userId,
            type: 'SERVICE_LINKED',
            occurredAt: now,
            details: {
              serviceId: dto.serviceId,
            },
          });
        }
      }

      const updated = await tx.incident.update({
        where: {
          organizationId_id: {
            organizationId: member.organizationId,
            id: incidentId,
          },
        },
        data: {
          ...(statusChanged
            ? {
                status: dto.status,
                resolvedAt: dto.status === 'RESOLVED' ? now : null,
              }
            : {}),
          ...(severityChanged ? { severity: dto.severity } : {}),
          ...(summaryChanged ? { summary: dto.summary } : {}),
          ...(serviceChanged ? { serviceId: dto.serviceId } : {}),
        },
        select: incidentFields,
      });

      for (const event of events) {
        await tx.incidentEvent.create({
          data: event,
        });
      }

      return toResponse(updated);
    });
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
          orderBy: { sequence: 'asc' },
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
