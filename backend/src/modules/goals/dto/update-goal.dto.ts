import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsDateString,
  IsUUID,
  Min,
} from 'class-validator';
import { MetricType, ComparisonOp, GoalStatus } from '@prisma/client';

/**
 * DTO for updating an existing goal
 */
export class UpdateGoalDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(MetricType)
  @IsOptional()
  metricType?: MetricType;

  @IsNumber()
  @Min(0)
  @IsOptional()
  targetValue?: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  currentValue?: number;

  @IsEnum(ComparisonOp)
  @IsOptional()
  operator?: ComparisonOp;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsUUID()
  @IsOptional()
  teamId?: string;

  @IsUUID()
  @IsOptional()
  projectId?: string;

  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;

  @IsEnum(GoalStatus)
  @IsOptional()
  status?: GoalStatus;
}
