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
//# sourceMappingURL=index.d.ts.map