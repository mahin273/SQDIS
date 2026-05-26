import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsDateString,
  IsUUID,
  Min,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MetricType, ComparisonOp } from '@prisma/client';
import { CreateKeyResultDto } from './create-key-result.dto';

/**
 * DTO for creating a new goal
 */
export class CreateGoalDto {
  /**
   * Optional template ID to pre-fill goal values from
   * When provided, metricType, targetValue, operator, and duration are derived from template
   */
  @IsUUID()
  @IsOptional()
  templateId?: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

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

  @IsEnum(ComparisonOp)
  @IsOptional()
  operator?: ComparisonOp;

  @IsDateString()
  startDate!: string;

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
  isPublic?: boolean = true;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateKeyResultDto)
  @IsOptional()
  keyResults?: CreateKeyResultDto[];
}
