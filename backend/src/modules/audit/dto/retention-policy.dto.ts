import { IsInt, IsOptional, Min, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

/**
 * DTO for updating retention policy
 */
export class UpdateRetentionPolicyDto {
  @ApiProperty({
    description: 'Default retention period in days (minimum 90)',
    example: 365,
    minimum: 90,
  })
  @IsInt()
  @Min(90, { message: 'Retention period must be at least 90 days' })
  @Type(() => Number)
  defaultRetentionDays: number;

  @ApiPropertyOptional({
    description: 'Action-specific retention periods (in days)',
    example: {
      LOGIN: 180,
      PERMISSION_CHECK: 90,
      ROLE_CHANGE: 730,
    },
  })
  @IsOptional()
  @IsObject()
  actionSpecificRetention?: Record<string, number>;
}
