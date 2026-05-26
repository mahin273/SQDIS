import { IsOptional, IsString, IsBoolean, IsNumber, IsEnum, IsDateString } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { MetricType } from '@prisma/client';

/**
 * DTO for filtering goal history/snapshots
 */
export class GoalHistoryFiltersDto {
  @IsOptional()
  @IsString()
  teamId?: string;

  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsOptional()
  @IsEnum(MetricType)
  metricType?: MetricType;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  wasAchieved?: boolean;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number = 20;
}
