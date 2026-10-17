import { Transform } from 'class-transformer';
import { IsNotIn, IsString, Length, Matches } from 'class-validator';
import type { CreateOrganizationRequest } from '@opspilot/contracts';

export const ORGANIZATION_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Top-level web routes that an organization slug must never shadow.
export const RESERVED_ORGANIZATION_SLUGS = [
  'api',
  'auth',
  'login',
  'logout',
  'onboarding',
  'settings',
  'signup',
];

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateOrganizationDto implements CreateOrganizationRequest {
  @Transform(trim)
  @IsString()
  @Length(2, 120)
  name!: string;

  @Transform(trim)
  @IsString()
  @Length(3, 80)
  @Matches(ORGANIZATION_SLUG_PATTERN, {
    message: 'slug must contain lowercase letters, numbers, and single hyphens.',
  })
  @IsNotIn(RESERVED_ORGANIZATION_SLUGS, { message: 'slug is reserved.' })
  slug!: string;
}
