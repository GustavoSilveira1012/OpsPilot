import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUrl, Length, MaxLength, ValidateIf } from 'class-validator';

import type { UpdateServiceRequest } from '@opspilot/contracts';
import { ServiceStatus, ServiceTier } from '../generated/prisma/enums.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class UpdateServiceDto implements UpdateServiceRequest {
  @ValidateIf((_object, value) => value !== undefined)
  @Transform(trim)
  @IsString()
  @Length(2, 160)
  name?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(Object.values(ServiceTier))
  tier?: ServiceTier;

  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(Object.values(ServiceStatus))
  status?: ServiceStatus;

  @IsOptional()
  @Transform(trim)
  @IsUrl({
    require_protocol: true,
    protocols: ['http', 'https'],
  })
  @MaxLength(2048)
  runbookUrl?: string | null;
}
