import { IsOptional, IsNumber, IsBoolean, IsEnum, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AlertType, AlertSeverity } from '@prisma/client';

/**
 * DTO for creating alert threshold configuration
 */
export class CreateAlertThresholdConfigDto {
  @ApiPropertyOptional({ description: 'Type of alert', enum: AlertType, default: AlertType.ANOMALY })
  @IsOptional()
  @IsEnum(AlertType)
  alertType?: AlertType = AlertType.ANOMALY;

  @ApiPropertyOptional({ description: 'Low severity threshold', minimum: 0, maximum: 1, default: 0.0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  lowThreshold?: number = 0.0;

  @ApiPropertyOptional({ description: 'Medium severity threshold', minimum: 0, maximum: 1, default: 0.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  mediumThreshold?: number = 0.5;

  @ApiPropertyOptional({ description: 'High severity threshold', minimum: 0, maximum: 1, default: 0.7 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  highThreshold?: number = 0.7;

  @ApiPropertyOptional({ description: 'Critical severity threshold', minimum: 0, maximum: 1, default: 0.9 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  criticalThreshold?: number = 0.9;

  @ApiPropertyOptional({ description: 'Minimum severity level to trigger alert', enum: AlertSeverity, default: AlertSeverity.LOW })
  @IsOptional()
  @IsEnum(AlertSeverity)
  minSeverity?: AlertSeverity = AlertSeverity.LOW;

  @ApiPropertyOptional({ description: 'Whether this configuration is active', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;
}

/**
 * DTO for updating alert threshold configuration
 */
export class UpdateAlertThresholdConfigDto {
  @ApiPropertyOptional({ description: 'Low severity threshold', minimum: 0, maximum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  lowThreshold?: number;

  @ApiPropertyOptional({ description: 'Medium severity threshold', minimum: 0, maximum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  mediumThreshold?: number;

  @ApiPropertyOptional({ description: 'High severity threshold', minimum: 0, maximum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  highThreshold?: number;

  @ApiPropertyOptional({ description: 'Critical severity threshold', minimum: 0, maximum: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  criticalThreshold?: number;

  @ApiPropertyOptional({ description: 'Minimum severity level to trigger alert', enum: AlertSeverity })
  @IsOptional()
  @IsEnum(AlertSeverity)
  minSeverity?: AlertSeverity;

  @ApiPropertyOptional({ description: 'Whether this configuration is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/**
 * DTO for resetting threshold configuration to defaults
 */
export class ResetAlertThresholdConfigDto {
  @ApiPropertyOptional({ description: 'Type of alert to reset', enum: AlertType })
  @IsOptional()
  @IsEnum(AlertType)
  alertType?: AlertType;
}
