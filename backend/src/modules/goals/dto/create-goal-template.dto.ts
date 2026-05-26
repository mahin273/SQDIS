import { IsString, IsNotEmpty, IsEnum, IsNumber, IsInt, Min } from 'class-validator';
import { MetricType, ComparisonOp } from '@prisma/client';

/**
 * DTO for creating a goal template
 */
export class CreateGoalTemplateDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(MetricType)
  metricType!: MetricType;

  @IsNumber()
  @Min(0)
  targetValue!: number;

  @IsEnum(ComparisonOp)
  operator!: ComparisonOp;

  @IsInt()
  @Min(1)
  durationDays!: number;
}
