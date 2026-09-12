import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, Min, Max, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class MetricSnapshotDto {
  @ApiProperty({ description: 'P95 response time in milliseconds', example: 12.5 })
  @IsNumber()
  p95_latency_ms: number;

  @ApiProperty({ description: '5xx HTTP error rate in requests per second', example: 0.0 })
  @IsNumber()
  error_rate_5xx: number;

  @ApiProperty({ description: 'Process resident memory usage in megabytes', example: 178.0 })
  @IsNumber()
  memory_rss_mb: number;

  @ApiPropertyOptional({ description: 'Optional CPU utilization percentage', example: 14.2 })
  @IsOptional()
  @IsNumber()
  cpu_utilization_pct?: number;
}

export class MetricDeltaDto {
  @ApiProperty({ description: 'Percentage change in P95 latency', example: 4.8 })
  @IsNumber()
  latency_delta_pct: number;

  @ApiProperty({ description: 'Absolute change in 5xx error rate (req/s)', example: 0.0 })
  @IsNumber()
  error_rate_delta: number;

  @ApiProperty({ description: 'Percentage change in memory RSS usage', example: 2.5 })
  @IsNumber()
  memory_delta_pct: number;
}

export class CanaryViolationDto {
  @ApiProperty({ description: 'Metric name: p95_latency, error_rate_5xx, or memory_rss', example: 'p95_latency' })
  @IsString()
  metric: string;

  @ApiProperty({ description: 'Severity level: WARNING or CRITICAL', example: 'WARNING' })
  @IsString()
  severity: string;

  @ApiProperty({ description: 'Human-readable violation description', example: 'P95 latency spiked by 14.5%' })
  @IsString()
  description: string;

  @ApiProperty({ description: 'Observed value during observation', example: 24.5 })
  @IsNumber()
  observed_value: number;

  @ApiProperty({ description: 'Baseline value', example: 12.5 })
  @IsNumber()
  baseline_value: number;

  @ApiProperty({ description: 'Threshold rule breached', example: '> 10.0%' })
  @IsString()
  threshold: string;
}

export class EvaluateTelemetryDto {
  @ApiPropertyOptional({ description: 'Target service to evaluate', default: 'sqdis-backend' })
  @IsOptional()
  @IsString()
  serviceName?: string;

  @ApiPropertyOptional({ description: 'Baseline observation duration in minutes', default: 15 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1440)
  baselineDurationMinutes?: number;

  @ApiPropertyOptional({ description: 'Canary observation duration in minutes', default: 10 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1440)
  canaryDurationMinutes?: number;

  @ApiPropertyOptional({ description: 'Optional custom baseline snapshot for synthetic testing' })
  @IsOptional()
  @ValidateNested()
  @Type(() => MetricSnapshotDto)
  customBaseline?: MetricSnapshotDto;

  @ApiPropertyOptional({ description: 'Optional custom canary snapshot for synthetic testing' })
  @IsOptional()
  @ValidateNested()
  @Type(() => MetricSnapshotDto)
  customCanary?: MetricSnapshotDto;
}

export class ReleaseTelemetryResponseDto {
  @ApiProperty({ description: 'Analysis unique identifier' })
  id: string;

  @ApiProperty({ description: 'Associated release ID' })
  releaseId: string;

  @ApiProperty({ description: 'Service evaluated' })
  serviceName: string;

  @ApiProperty({ description: 'Verdict: HEALTHY, DEGRADED, or CRITICAL_REGRESSION' })
  verdict: 'HEALTHY' | 'DEGRADED' | 'CRITICAL_REGRESSION';

  @ApiProperty({ description: 'Recommendation: PROCEED, MONITOR_CLOSELY, or TRIGGER_ROLLBACK' })
  recommendation: 'PROCEED' | 'MONITOR_CLOSELY' | 'TRIGGER_ROLLBACK';

  @ApiProperty({ description: 'Telemetry operational stability score (0-100)' })
  score: number;

  @ApiProperty({ description: 'Baseline metrics snapshot' })
  baselineMetrics: MetricSnapshotDto;

  @ApiProperty({ description: 'Canary metrics snapshot' })
  canaryMetrics: MetricSnapshotDto;

  @ApiProperty({ description: 'Metric shifts and deltas' })
  deltas: MetricDeltaDto;

  @ApiProperty({ description: 'Operational rule breaches', type: [CanaryViolationDto] })
  violations: CanaryViolationDto[];

  @ApiProperty({ description: 'Evaluation timestamp' })
  createdAt: Date;
}
