import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsDateString, MinLength, MaxLength } from 'class-validator';

/**
 * DTO for updating a sprint
 */
export class UpdateSprintDto {
  @ApiPropertyOptional({
    description: 'Sprint name',
    example: 'Sprint 1 - Q1 2024 (Updated)',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @IsOptional()
  @MinLength(1, { message: 'Sprint name must be at least 1 character long' })
  @MaxLength(100, { message: 'Sprint name must not exceed 100 characters' })
  name?: string;

  @ApiPropertyOptional({
    description: 'Sprint start date (ISO 8601)',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsDateString({}, { message: 'Start date must be a valid ISO 8601 date string' })
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Sprint end date (ISO 8601)',
    example: '2024-01-14T23:59:59.999Z',
  })
  @IsDateString({}, { message: 'End date must be a valid ISO 8601 date string' })
  @IsOptional()
  endDate?: string;
}
