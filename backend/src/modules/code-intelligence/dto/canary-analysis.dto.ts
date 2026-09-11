import { IsOptional, IsNumber } from 'class-validator';

export class CanaryAnalysisDto {
  @IsOptional()
  @IsNumber()
  baselineWindowSeconds?: number;

  @IsOptional()
  @IsNumber()
  canaryWindowSeconds?: number;

  @IsOptional()
  @IsNumber()
  latencyThresholdPct?: number;
}
