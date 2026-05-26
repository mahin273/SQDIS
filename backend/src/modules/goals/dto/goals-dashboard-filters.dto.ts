import { IsOptional, IsEnum, IsUUID, IsInt, Min, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { MetricType, GoalStatus } from '@prisma/client';

/**
 * DTO for filtering goals dashboard
 */
export class GoalsDashboardFiltersDto {
  @IsUUID()
  @IsOptional()
  teamId?: string;

  @IsEnum(GoalStatus)
  @IsOptional()
  status?: GoalStatus;

  @IsEnum(MetricType)
  @IsOptional()
  metricType?: MetricType;

  @IsUUID()
  @IsOptional()
  ownerId?: string;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  includePersonal?: boolean = true;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  includeTeam?: boolean = true;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 50;
}
