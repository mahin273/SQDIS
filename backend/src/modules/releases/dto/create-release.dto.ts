import { IsString, IsNotEmpty, IsDateString, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for creating a new release
 */
export class CreateReleaseDto {
  @ApiProperty({
    description: 'Release version (e.g., v1.0.0, 2.1.0)',
    example: 'v1.0.0',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  version!: string;

  @ApiProperty({
    description: 'Target release date',
    example: '2024-03-15',
  })
  @IsDateString()
  targetDate!: string;

  @ApiPropertyOptional({
    description: 'Release description',
    example: 'Major release with new features and bug fixes',
  })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;
}
