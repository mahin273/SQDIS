/**eslint-disable */
import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for testing webhook connectivity
 */
export class TestWebhookDto {
  @ApiProperty({
    description: 'Repository ID to test webhook connectivity',
    example: 'repo-uuid-123',
  })
  @IsString()
  @IsNotEmpty()
  repositoryId: string;
}
