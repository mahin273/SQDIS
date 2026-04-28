import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for querying webhook health metrics
 */
export class QueryWebhookHealthDto {
  @ApiPropertyOptional({
    description: 'Time period for health metrics',
    enum: ['24h', '7d', '30d'],
    example: '7d',
    default: '7d',
  })
  @IsEnum(['24h', '7d', '30d'])
  @IsOptional()
  period?: '24h' | '7d' | '30d' = '7d';
}
