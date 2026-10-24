import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

import { IncidentSeverity, IncidentStatus } from '../generated/prisma/enums.js';

export class ListIncidentsDto {
  @IsOptional()
  @IsIn(Object.values(IncidentStatus))
  status?: IncidentStatus;

  @IsOptional()
  @IsIn(Object.values(IncidentSeverity))
  severity?: IncidentSeverity;

  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === undefined || value === null ? value : Number(value),
  )
  @IsInt()
  @Min(0)
  @Max(1000000)
  offset?: number;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === undefined || value === null ? value : Number(value),
  )
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
