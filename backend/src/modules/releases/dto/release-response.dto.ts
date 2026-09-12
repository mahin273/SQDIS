import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Sprint summary for release response
 */
export class SprintSummaryDto {
  @ApiProperty({ description: 'Sprint ID' })
  id!: string;

  @ApiProperty({ description: 'Sprint name' })
  name!: string;

  @ApiProperty({ description: 'Sprint start date' })
  startDate!: Date;

  @ApiProperty({ description: 'Sprint end date' })
  endDate!: Date;

  @ApiProperty({ description: 'Team name' })
  teamName!: string;
}

/**
 * Release readiness score breakdown
 */
export class ReadinessScoreDto {
  @ApiProperty({
    description: 'Overall readiness score (0-100)',
    example: 75.5,
  })
  score!: number;

  @ApiProperty({
    description: 'Bug score component (30% weight)',
    example: 80,
  })
  bugScore!: number;

  @ApiProperty({
    description: 'Coverage score component (25% weight)',
    example: 70,
  })
  coverageScore!: number;

  @ApiProperty({
    description: 'DQS score component (25% weight)',
    example: 85,
  })
  dqsScore!: number;

  @ApiProperty({
    description: 'Test pass rate component (20% weight)',
    example: 65,
  })
  testPassRate!: number;

  @ApiProperty({
    description: 'Whether readiness is below 70% threshold',
    example: false,
  })
  isAtRisk!: boolean;

  @ApiPropertyOptional({
    description: 'Operational telemetry stability score component (20% weight if available)',
    example: 95,
  })
  telemetryScore?: number;

  @ApiPropertyOptional({
    description: 'Latest canary telemetry verdict',
    example: 'HEALTHY',
  })
  telemetryVerdict?: 'HEALTHY' | 'DEGRADED' | 'CRITICAL_REGRESSION';

  @ApiPropertyOptional({
    description: 'Operational recommendation',
    example: 'PROCEED',
  })
  telemetryRecommendation?: 'PROCEED' | 'MONITOR_CLOSELY' | 'TRIGGER_ROLLBACK';

  @ApiPropertyOptional({
    description: 'Whether live telemetry analysis has been executed',
    example: true,
  })
  hasTelemetry?: boolean;
}

/**
 * Release response DTO
 */
export class ReleaseResponseDto {
  @ApiProperty({ description: 'Release ID' })
  id!: string;

  @ApiProperty({ description: 'Release version' })
  version!: string;

  @ApiProperty({ description: 'Target release date' })
  targetDate!: Date;

  @ApiPropertyOptional({ description: 'Release description' })
  description?: string;

  @ApiPropertyOptional({ description: 'Actual ship date' })
  shippedAt?: Date;

  @ApiProperty({ description: 'Whether the release is active' })
  isActive!: boolean;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt!: Date;

  @ApiProperty({
    description: 'Associated sprints',
    type: [SprintSummaryDto],
  })
  sprints!: SprintSummaryDto[];

  @ApiPropertyOptional({
    description: 'Release readiness score (calculated on demand)',
    type: ReadinessScoreDto,
  })
  readiness?: ReadinessScoreDto;

  @ApiPropertyOptional({
    description: 'Whether the release has been rolled back due to failure/incident',
    example: false,
  })
  isRolledBack?: boolean;

  @ApiPropertyOptional({
    description: 'Timestamp when rollback was executed',
  })
  rolledBackAt?: Date;

  @ApiPropertyOptional({
    description: 'Reason for rollback',
    example: 'P95 latency spike detected in canary telemetry',
  })
  rollbackReason?: string;

  @ApiPropertyOptional({
    description: 'User ID who triggered the rollback',
  })
  rollbackTriggeredBy?: string;
}

