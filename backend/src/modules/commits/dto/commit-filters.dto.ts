import {
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  IsEnum,
  IsDateString,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CommitClassification } from '@prisma/client';

/**
 * DTO for commit list filters and pagination
 */
export class CommitFiltersDto {
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

  @ApiPropertyOptional({ description: 'Commit classification', enum: CommitClassification })
  @IsOptional()
  @IsEnum(CommitClassification)
  classification?: CommitClassification;

  @ApiPropertyOptional({ description: 'Start date for filtering commits' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date for filtering commits' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Search by commit message or author' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter anomalous commits only' })
  @IsOptional()
  @Type(() => Boolean)
  anomalyOnly?: boolean;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
