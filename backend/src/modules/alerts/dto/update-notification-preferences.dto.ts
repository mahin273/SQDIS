import { IsOptional, IsBoolean, IsString, IsEnum, Matches, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AlertSeverity } from '@prisma/client';

/**
 * DTO for updating notification preferences
 */
export class UpdateNotificationPreferencesDto {
  @ApiPropertyOptional({ description: 'Enable email notifications' })
  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Enable Slack notifications' })
  @IsOptional()
  @IsBoolean()
  slackEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Enable in-app notifications' })
  @IsOptional()
  @IsBoolean()
  inAppEnabled?: boolean;

  /**
   * Quiet hours start time in HH:mm format
   */
  @ApiPropertyOptional({ description: 'Quiet hours start time (HH:mm format)', example: '22:00' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'quietStart must be in HH:mm format (e.g., 22:00)',
  })
  quietStart?: string;

  /**
   * Quiet hours end time in HH:mm format
   */
  @ApiPropertyOptional({ description: 'Quiet hours end time (HH:mm format)', example: '07:00' })
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'quietEnd must be in HH:mm format (e.g., 07:00)',
  })
  quietEnd?: string;

  /**
   * Enable digest mode for batched notifications
   */
  @ApiPropertyOptional({ description: 'Enable digest mode to batch notifications' })
  @IsOptional()
  @IsBoolean()
  digestMode?: boolean;

  /**
   * Frequency for digest notifications: hourly, daily, or weekly
   */
  @ApiPropertyOptional({ description: 'Frequency of digest notifications', enum: ['hourly', 'daily', 'weekly'] })
  @IsOptional()
  @IsString()
  @IsIn(['hourly', 'daily', 'weekly'], {
    message: 'digestFrequency must be one of: hourly, daily, weekly',
  })
  digestFrequency?: string;

  @ApiPropertyOptional({ description: 'Minimum severity level to trigger notifications', enum: AlertSeverity })
  @IsOptional()
  @IsEnum(AlertSeverity)
  minSeverity?: AlertSeverity;
}
