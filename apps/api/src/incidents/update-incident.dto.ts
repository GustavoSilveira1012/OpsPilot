import { IsIn, IsOptional, IsString, IsUUID, MaxLength, ValidateIf } from 'class-validator';

import type { UpdateIncidentRequest } from '@opspilot/contracts';
import { IncidentSeverity, IncidentStatus } from '../generated/prisma/enums.js';

export class UpdateIncidentDto implements UpdateIncidentRequest {
  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(Object.values(IncidentStatus))
  status?: IncidentStatus;

  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(Object.values(IncidentSeverity))
  severity?: IncidentSeverity;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  summary?: string | null;

  @ValidateIf((_object, value) => value !== undefined && value !== null)
  @IsUUID()
  serviceId?: string | null;
}
