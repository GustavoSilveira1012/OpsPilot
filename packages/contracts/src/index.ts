export interface HealthResponse {
  readonly status: 'ok';
  readonly service: 'opspilot-api';
  readonly version: string;
  readonly timestamp: string;
}

export type OrganizationRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export interface CreateOrganizationRequest {
  readonly name: string;
  readonly slug: string;
}

export interface OrganizationSummary {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
}

export interface UpdateIncidentRequest {
  status?: IncidentStatus;
  severity?: IncidentSeverity;
  summary?: string | null;
  serviceId?: string | null;
}

export interface OrganizationMembershipResponse {
  readonly organization: OrganizationSummary;
  readonly role: OrganizationRole;
}

export type ServiceTier = 'TIER_0' | 'TIER_1' | 'TIER_2' | 'TIER_3';

export type ServiceStatus =
  'OPERATIONAL' | 'DEGRADED' | 'PARTIAL_OUTAGE' | 'MAJOR_OUTAGE' | 'MAINTENANCE';

export type IncidentSeverity = 'SEV1' | 'SEV2' | 'SEV3' | 'SEV4';

export type IncidentStatus = 'INVESTIGATING' | 'IDENTIFIED' | 'MONITORING' | 'RESOLVED';

export type IncidentEventType =
  | 'INCIDENT_CREATED'
  | 'STATUS_CHANGED'
  | 'SEVERITY_CHANGED'
  | 'DESCRIPTION_UPDATED'
  | 'MESSAGE_ADDED'
  | 'RESPONDER_ASSIGNED'
  | 'RESPONDER_REMOVED'
  | 'SERVICE_LINKED'
  | 'SERVICE_UNLINKED';

export interface CreateIncidentRequest {
  title: string;
  summary?: string | null;
  severity?: IncidentSeverity;
  serviceId?: string | null;
}

export interface IncidentResponse {
  id: string;
  number: number;
  title: string;
  summary: string | null;
  status: IncidentStatus;
  severity: IncidentSeverity;
  serviceId: string | null;
  createdByUserId: string;
  startedAt: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IncidentEventResponse {
  id: string;
  type: IncidentEventType;
  actorUserId: string | null;
  message: string | null;
  details: unknown;
  occurredAt: string;
}

export interface IncidentDetailResponse extends IncidentResponse {
  timeline: IncidentEventResponse[];
}

export interface IncidentListResponse {
  items: IncidentResponse[];
  total: number;
}

export interface CreateServiceRequest {
  name: string;
  slug: string;
  description?: string | null;
  tier?: ServiceTier;
  runbookUrl?: string | null;
}

export interface UpdateServiceRequest {
  name?: string;
  description?: string | null;
  tier?: ServiceTier;
  status?: ServiceStatus;
  runbookUrl?: string | null;
}

export interface ServiceResponse {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  tier: ServiceTier;
  status: ServiceStatus;
  runbookUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMemberResponse {
  userId: string;
  displayName: string | null;
  email: string | null;
  role: OrganizationRole;
}

export interface ServiceOwnerResponse extends OrganizationMemberResponse {
  assignedAt: string;
}


export interface IncidentResponderResponse
  extends OrganizationMemberResponse {
  assignedAt: string;
  assignedByUserId: string | null;
}