import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';
import type { CreateIncidentNoteRequest } from '@opspilot/contracts';

export class CreateIncidentNoteDto implements CreateIncidentNoteRequest {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 4000)
  message!: string;
}
