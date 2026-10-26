import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import type { UpdateIncidentRequest } from '@opspilot/contracts';
import { IncidentSeverity, IncidentStatus } from '../generated/prisma/enums.js';

export class UpdateIncidentDto implements UpdateIncidentRequest {
  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(Object.values(IncidentStatus))
  status?: IncidentStatus;

  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(Object.values(IncidentSeverity))
  severity?: IncidentSeverity;

  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MaxLength(10000)
  summary?: string | null;
}
