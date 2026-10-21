import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import type { CreateServiceRequest } from '@opspilot/contracts';
import { ServiceTier } from '../generated/prisma/enums.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateServiceDto implements CreateServiceRequest {
  @Transform(trim)
  @IsString()
  @Length(2, 160)
  name!: string;

  @Transform(trim)
  @IsString()
  @Length(3, 100)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must contain lowercase letters, numbers, and single hyphens.',
  })
  slug!: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(Object.values(ServiceTier))
  tier?: ServiceTier;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  runbookUrl?: string | null;
}
