/**eslint-disable */
import { IsString, IsOptional, IsEnum, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

/**
 * DTO for querying webhook logs
 */
export class QueryWebhookLogsDto {
  @ApiPropertyOptional({
    description: 'Repository ID to filter logs',
    example: 'repo-uuid-123',
  })
  @IsString()
  @IsOptional()
  repositoryId?: string;

  @ApiPropertyOptional({
    description: 'Start date for date range filter (ISO 8601 format)',
    example: '2024-01-01T00:00:00Z',
  })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date for date range filter (ISO 8601 format)',
    example: '2024-01-31T23:59:59Z',
  })
  @IsDateString()
  @IsOptional()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Filter by processing status',
    enum: ['success', 'failed'],
    example: 'success',
  })
  @IsEnum(['success', 'failed'])
  @IsOptional()
  @Transform(({ value }) => value?.toLowerCase())
  status?: 'success' | 'failed';
}
