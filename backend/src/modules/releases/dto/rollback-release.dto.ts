import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl } from 'class-validator';

export class RollbackReleaseDto {
  @ApiPropertyOptional({
    description: 'Specific reason for triggering the rollback',
    example: 'P95 latency spiked by +42% and 5xx error rate exceeded 1.2% in canary window',
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({
    description: 'Custom webhook URL to dispatch the rollback payload to (overrides org setting)',
    example: 'https://api.github.com/repos/org/repo/dispatches',
  })
  @IsOptional()
  @IsUrl()
  webhookUrl?: string;

  @ApiPropertyOptional({
    description: 'Target previous stable version to revert to',
    example: 'v1.4.0',
  })
  @IsOptional()
  @IsString()
  targetStableVersion?: string;
}

export class RollbackResponseDto {
  @ApiProperty({ example: true })
  success!: boolean;

  @ApiProperty({ example: 'c64a59f6-16e0-410a-b333-e07503da0264' })
  releaseId!: string;

  @ApiProperty({ example: 'v2.0.0' })
  version!: string;

  @ApiProperty({ example: true })
  isRolledBack!: boolean;

  @ApiProperty({ example: '2026-09-12T17:40:00.000Z' })
  rolledBackAt!: string;

  @ApiProperty({ example: 'P95 latency spike detected in canary telemetry' })
  rollbackReason!: string;

  @ApiPropertyOptional({ example: 'user-123' })
  rollbackTriggeredBy?: string;

  @ApiProperty({ example: true })
  webhookDispatched!: boolean;

  @ApiPropertyOptional({ example: 200 })
  webhookHttpStatus?: number | null;

  @ApiPropertyOptional({ description: 'Outbound dispatch payload sent to CI/CD orchestrator' })
  dispatchedPayload?: any;
}
