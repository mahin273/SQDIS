import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID, IsDateString, MinLength, MaxLength } from 'class-validator';

/**
 * DTO for creating a new sprint
 */
export class CreateSprintDto {
  @ApiProperty({
    description: 'Sprint name',
    example: 'Sprint 1 - Q1 2024',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty({ message: 'Sprint name is required' })
  @MinLength(1, { message: 'Sprint name must be at least 1 character long' })
  @MaxLength(100, { message: 'Sprint name must not exceed 100 characters' })
  name!: string;

  @ApiProperty({
    description: 'Sprint start date (ISO 8601)',
    example: '2024-01-01T00:00:00.000Z',
  })
  @IsDateString({}, { message: 'Start date must be a valid ISO 8601 date string' })
  @IsNotEmpty({ message: 'Start date is required' })
  startDate!: string;

  @ApiProperty({
    description: 'Sprint end date (ISO 8601)',
    example: '2024-01-14T23:59:59.999Z',
  })
  @IsDateString({}, { message: 'End date must be a valid ISO 8601 date string' })
  @IsNotEmpty({ message: 'End date is required' })
  endDate!: string;

  @ApiProperty({
    description: 'Team ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID('4', { message: 'Team ID must be a valid UUID' })
  @IsNotEmpty({ message: 'Team ID is required' })
  teamId!: string;
}
