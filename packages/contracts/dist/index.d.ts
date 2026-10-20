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
export interface OrganizationMembershipResponse {
    readonly organization: OrganizationSummary;
    readonly role: OrganizationRole;
}
export type ServiceTier = 'TIER_0' | 'TIER_1' | 'TIER_2' | 'TIER_3';
export type ServiceStatus = 'OPERATIONAL' | 'DEGRADED' | 'PARTIAL_OUTAGE' | 'MAJOR_OUTAGE' | 'MAINTENANCE';
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
export interface ServiceOwnerResponse {
    userId: string;
    displayName: string | null;
    email: string | null;
    role: OrganizationRole;
    assignedAt: string;
}
//# sourceMappingURL=index.d.ts.map