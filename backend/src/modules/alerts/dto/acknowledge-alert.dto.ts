import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for acknowledging an alert
 */
export class AcknowledgeAlertDto {
  @ApiPropertyOptional({ description: 'Optional notes when acknowledging the alert' })
  @IsOptional()
  @IsString()
  notes?: string;
}
