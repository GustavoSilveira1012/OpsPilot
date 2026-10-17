import { Transform } from 'class-transformer';
import { IsNotIn, IsString, Length, Matches } from 'class-validator';
import { organizationSlugPattern, reservedOrganizationSlugs } from '@opspilot/contracts';

export class CreateOrganizationDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 120)
  name!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @Length(3, 80)
  @Matches(organizationSlugPattern, {
    message: 'slug must use lowercase letters, numbers and single hyphens',
  })
  @IsNotIn([...reservedOrganizationSlugs], { message: 'This workspace URL is reserved.' })
  slug!: string;
}
