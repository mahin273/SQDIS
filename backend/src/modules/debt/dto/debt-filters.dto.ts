import { IsOptional, IsString, IsEnum, IsInt, Min, IsBoolean, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { DebtMarker } from '@prisma/client';

/**
 * DTO for filtering debt items
 */
export class DebtFiltersDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  repositoryId?: string;

  @IsOptional()
  @IsString()
  authorId?: string;

  @IsOptional()
  @IsEnum(DebtMarker)
  markerType?: DebtMarker;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isResolved?: boolean;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  filePath?: string;
}
