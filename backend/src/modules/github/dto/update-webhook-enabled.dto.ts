import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

/**
 * DTO for updating webhook enabled status
 */
export class UpdateWebhookEnabledDto {
  @ApiProperty({
    description: 'Whether webhook processing should be enabled for this repository',
    example: true,
  })
  @IsBoolean()
  enabled: boolean;
}
