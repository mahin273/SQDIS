import { IsOptional, IsUUID, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for commit statistics query
 */
export class CommitStatsQueryDto {
  @ApiPropertyOptional({ description: 'Organization ID' })
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @ApiPropertyOptional({ description: 'Repository ID' })
  @IsOptional()
  @IsUUID()
  repositoryId?: string;

  @ApiPropertyOptional({ description: 'Developer ID' })
  @IsOptional()
  @IsUUID()
  developerId?: string;

  @ApiPropertyOptional({ description: 'Start date for statistics' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date for statistics' })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
