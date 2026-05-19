import { IsOptional, IsBoolean, IsString, IsEnum, Matches, IsIn } from 'class-validator';
import { AlertSeverity } from '@prisma/client';

/**
 * DTO for updating notification preferences
 */
export class UpdateNotificationPreferencesDto {
  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  slackEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  inAppEnabled?: boolean;

  /**
   * Quiet hours start time in HH:mm format
   */
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'quietStart must be in HH:mm format (e.g., 22:00)',
  })
  quietStart?: string;

  /**
   * Quiet hours end time in HH:mm format
   */
  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'quietEnd must be in HH:mm format (e.g., 07:00)',
  })
  quietEnd?: string;

  /**
   * Enable digest mode for batched notifications
   */
  @IsOptional()
  @IsBoolean()
  digestMode?: boolean;

  /**
   * Frequency for digest notifications: hourly, daily, or weekly
   */
  @IsOptional()
  @IsString()
  @IsIn(['hourly', 'daily', 'weekly'], {
    message: 'digestFrequency must be one of: hourly, daily, weekly',
  })
  digestFrequency?: string;

  @IsOptional()
  @IsEnum(AlertSeverity)
  minSeverity?: AlertSeverity;
}
