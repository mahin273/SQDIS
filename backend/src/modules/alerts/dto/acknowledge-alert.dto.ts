import { IsOptional, IsString } from 'class-validator';

/**
 * DTO for acknowledging an alert
 */
export class AcknowledgeAlertDto {
  @IsOptional()
  @IsString()
  notes?: string;
}
