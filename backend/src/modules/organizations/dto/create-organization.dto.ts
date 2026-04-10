import { IsString, IsNotEmpty, IsOptional, MinLength, MaxLength, Matches } from 'class-validator';

export class CreateOrganizationDto {
  /**
   * The display name of the organization
   * Example: "Acme Corporation"
   */
  @IsString()
  @IsNotEmpty({ message: 'Organization name is required' })
  @MinLength(2, { message: 'Name must be at least 2 characters' })
  @MaxLength(100, { message: 'Name must not exceed 100 characters' })
  name: string;

  /**
   * Unique URL-friendly identifier for the organization
   * Example: "acme-corp"
   */
  @IsString()
  @IsNotEmpty({ message: 'Slug is required' })
  @MinLength(2, { message: 'Slug must be at least 2 characters' })
  @MaxLength(50, { message: 'Slug must not exceed 50 characters' })
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug can only contain lowercase letters, numbers, and hyphens' })
  slug: string;

  /**
   * Optional logo URL for the organization
   */
  @IsOptional()
  @IsString()
  logoUrl?: string;
}