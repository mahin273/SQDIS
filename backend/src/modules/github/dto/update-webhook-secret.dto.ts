import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength, Matches } from 'class-validator';

/**
 * DTO for updating repository webhook secret
 */
export class UpdateWebhookSecretDto {
  @ApiProperty({
    description: 'New webhook secret for GitHub webhook signature validation',
    example: 'my-secure-webhook-secret-123',
    minLength: 8,
    maxLength: 256,
  })
  @IsString()
  @MinLength(8, { message: 'Webhook secret must be at least 8 characters long' })
  @MaxLength(256, { message: 'Webhook secret must not exceed 256 characters' })
  @Matches(/^[a-zA-Z0-9_\-!@#$%^&*()+=[\]{}|;:,.<>?]+$/, {
    message: 'Webhook secret contains invalid characters',
  })
  webhookSecret: string;
}
