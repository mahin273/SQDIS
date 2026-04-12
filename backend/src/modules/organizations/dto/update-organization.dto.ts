/* eslint-disable prettier/prettier */
import { IsString, IsOptional, MinLength, MaxLength, Matches, IsUrl } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateOrganizationDto {
  @ApiProperty({
    description: 'Organization name',
    example: 'SQDIS',
    minLength: 2,
    maxLength: 100,
  })
  /**
   * Updated display name of the organization
   */
  @IsOptional()
  @IsString()
  @MinLength(2, { message: ' Organization Name must be at least 2 characters' })
  @MaxLength(100, { message: ' Organization Name must not exceed 100 characters' })
  name?: string;

  @ApiProperty({
    description: 'Organization slug (alphanumeric with hyphens only)',
    example: 'sqdis',
    minLength: 2,
    maxLength: 50,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MinLength(2, { message: ' Organization Slug must be at least 2 characters' })
  @MaxLength(50, { message: ' Organization Slug must not exceed 50 characters' })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Slug can only contain lowercase letters, numbers, and hyphens' })
  slug?: string;

  @ApiProperty({
    description: 'Organization logo URL',
    example: 'https://example.com/logo.png',
    required: false,
  })

  /**
   * Updated logo URL for the organization
   */
  @IsOptional()
  @IsString()
  @IsUrl({},{message: 'Logo URL must be a valid URL'})
  logoUrl?: string;
}
