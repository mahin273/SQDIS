import { IsString, IsOptional, MinLength, MaxLength } from 'class-validator';

export class UpdateOrganizationDto {
  /**
   * Updated display name of the organization
   */
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters' })
  @MaxLength(100, { message: 'Name must not exceed 100 characters' })
  name?: string;

  /**
   * Updated logo URL for the organization
   */
  @IsOptional()
  @IsString()
  logoUrl?: string;
}