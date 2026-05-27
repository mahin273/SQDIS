import { IsString, IsDateString, IsOptional, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for updating a release
 */
export class UpdateReleaseDto {
  @ApiPropertyOptional({
    description: 'Release version',
    example: 'v1.0.1',
  })
  @IsString()
  @IsOptional()
  @MaxLength(50)
  version?: string;

  @ApiPropertyOptional({
    description: 'Target release date',
    example: '2024-03-20',
  })
  @IsDateString()
  @IsOptional()
  targetDate?: string;

  @ApiPropertyOptional({
    description: 'Release description',
    example: 'Updated release with additional fixes',
  })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({
    description: 'Actual ship date (set when release is shipped)',
    example: '2024-03-18',
  })
  @IsDateString()
  @IsOptional()
  shippedAt?: string;
}
