import { IsOptional, IsEnum, IsUUID, IsInt, Min, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { MetricType, GoalStatus } from '@prisma/client';

/**
 * DTO for filtering goals
 */
export class GoalFiltersDto {
  @IsUUID()
  @IsOptional()
  teamId?: string;

  @IsUUID()
  @IsOptional()
  projectId?: string;

  @IsUUID()
  @IsOptional()
  ownerId?: string;

  @IsEnum(MetricType)
  @IsOptional()
  metricType?: MetricType;

  @IsEnum(GoalStatus)
  @IsOptional()
  status?: GoalStatus;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  isPublic?: boolean;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  includeKeyResults?: boolean;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 20;
}
