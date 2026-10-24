import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, Length, MaxLength } from 'class-validator';

import type { CreateIncidentRequest } from '@opspilot/contracts';
import { IncidentSeverity } from '../generated/prisma/enums.js';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateIncidentDto implements CreateIncidentRequest {
  @Transform(trim)
  @IsString()
  @Length(4, 200)
  title!: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  summary?: string | null;

  @IsOptional()
  @IsIn(Object.values(IncidentSeverity))
  severity?: IncidentSeverity;

  @IsOptional()
  @IsUUID()
  serviceId?: string | null;
}
