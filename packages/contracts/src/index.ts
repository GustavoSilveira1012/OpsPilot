export interface HealthResponse {
  readonly status: 'ok';
  readonly service: 'opspilot-api';
  readonly version: string;
  readonly timestamp: string;
}

export const organizationSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const reservedOrganizationSlugs = [
  'api',
  'auth',
  'login',
  'signup',
  'onboarding',
  'dashboard',
  'admin',
  'settings',
] as const;

export interface CreateOrganizationInput {
  readonly name: string;
  readonly slug: string;
}

export interface OrganizationSummary {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly role: 'OWNER' | 'ADMIN' | 'MEMBER';
}
