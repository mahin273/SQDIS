import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsInt, Min, Max } from 'class-validator';

/**
 * DTO for updating webhook rate limit configuration
 */
export class UpdateRateLimitDto {
  @ApiProperty({
    description: 'Maximum number of webhook requests allowed per minute',
    example: 100,
    minimum: 1,
    maximum: 10000,
  })
  @IsInt({ message: 'Requests per minute must be an integer' })
  @Min(1, { message: 'Requests per minute must be at least 1' })
  @Max(10000, { message: 'Requests per minute must not exceed 10000' })
  requestsPerMinute: number;

  @ApiProperty({
    description: 'Whether rate limiting is enabled for the organization',
    example: true,
  })
  @IsBoolean({ message: 'Enabled must be a boolean value' })
  enabled: boolean;
}
