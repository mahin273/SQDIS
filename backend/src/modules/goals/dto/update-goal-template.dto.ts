import { IsString, IsOptional, IsEnum, IsNumber, IsInt, Min } from 'class-validator';
import { MetricType, ComparisonOp } from '@prisma/client';

/**
 * DTO for updating a goal template
 */
export class UpdateGoalTemplateDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(MetricType)
  @IsOptional()
  metricType?: MetricType;

  @IsNumber()
  @Min(0)
  @IsOptional()
  targetValue?: number;

  @IsEnum(ComparisonOp)
  @IsOptional()
  operator?: ComparisonOp;

  @IsInt()
  @Min(1)
  @IsOptional()
  durationDays?: number;
}
