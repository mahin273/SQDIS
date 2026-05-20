import { IsOptional, IsString, IsEnum, IsInt, Min, IsBoolean, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DebtMarker } from '@prisma/client';

/**
 * DTO for filtering debt items
 */
export class DebtFiltersDto {
  @ApiPropertyOptional({ description: 'Page number', minimum: 1, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', minimum: 1, default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Filter by repository ID' })
  @IsOptional()
  @IsString()
  repositoryId?: string;

  @ApiPropertyOptional({ description: 'Filter by author ID' })
  @IsOptional()
  @IsString()
  authorId?: string;

  @ApiPropertyOptional({ description: 'Filter by marker type', enum: DebtMarker })
  @IsOptional()
  @IsEnum(DebtMarker)
  markerType?: DebtMarker;

  @ApiPropertyOptional({ description: 'Filter by resolution status' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isResolved?: boolean;

  @ApiPropertyOptional({ description: 'Start date filter (ISO format)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date filter (ISO format)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Filter by file path (contains)' })
  @IsOptional()
  @IsString()
  filePath?: string;
}
