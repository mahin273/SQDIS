import { IsOptional, IsNumber, IsBoolean, IsEnum, Min, Max } from 'class-validator';
import { AlertType, AlertSeverity } from '@prisma/client';

/**
 * DTO for creating alert threshold configuration
 */
export class CreateAlertThresholdConfigDto {
  @IsOptional()
  @IsEnum(AlertType)
  alertType?: AlertType = AlertType.ANOMALY;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  lowThreshold?: number = 0.0;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  mediumThreshold?: number = 0.5;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  highThreshold?: number = 0.7;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  criticalThreshold?: number = 0.9;

  @IsOptional()
  @IsEnum(AlertSeverity)
  minSeverity?: AlertSeverity = AlertSeverity.LOW;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}

/**
 * DTO for updating alert threshold configuration
 */
export class UpdateAlertThresholdConfigDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  lowThreshold?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  mediumThreshold?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  highThreshold?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  criticalThreshold?: number;

  @IsOptional()
  @IsEnum(AlertSeverity)
  minSeverity?: AlertSeverity;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/**
 * DTO for resetting threshold configuration to defaults
 */
export class ResetAlertThresholdConfigDto {
  @IsOptional()
  @IsEnum(AlertType)
  alertType?: AlertType;
}
