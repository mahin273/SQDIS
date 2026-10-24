import { IsOptional, IsNumber, IsString } from 'class-validator';

export class CanaryAnalysisDto {
  @IsOptional()
  @IsString()
  repositoryId?: string;

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
