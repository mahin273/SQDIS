import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsIn } from 'class-validator';

export class TreemapQueryDto {
  @ApiPropertyOptional({ enum: ['loc', 'churn'], default: 'loc', description: 'Dimension used to determine rectangle area' })
  @IsOptional()
  @IsIn(['loc', 'churn'])
  sizeBy?: 'loc' | 'churn' = 'loc';

  @ApiPropertyOptional({ enum: ['complexity', 'defectRisk', 'debtCount'], default: 'complexity', description: 'Dimension used for heat color' })
  @IsOptional()
  @IsIn(['complexity', 'defectRisk', 'debtCount'])
  colorBy?: 'complexity' | 'defectRisk' | 'debtCount' = 'complexity';
}

export class TreemapNodeDto {
  @ApiProperty({ example: 'auth.service.ts' })
  name: string;

  @ApiProperty({ example: 'src/modules/auth/auth.service.ts' })
  path: string;

  @ApiProperty({ enum: ['directory', 'file'], example: 'file' })
  type: 'directory' | 'file';

  @ApiProperty({ example: 420 })
  loc: number;

  @ApiProperty({ example: 14.5 })
  cyclomaticComplexity: number;

  @ApiProperty({ example: 22 })
  cognitiveComplexity: number;

  @ApiProperty({ example: 0.68 })
  defectProbability: number;

  @ApiProperty({ example: 4 })
  debtCount: number;

  @ApiProperty({ example: 18 })
  churnCount: number;

  @ApiProperty({ enum: ['CRITICAL', 'HIGH', 'MODERATE', 'LOW'], example: 'HIGH' })
  riskLevel: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';

  @ApiPropertyOptional({ type: () => [TreemapNodeDto] })
  children?: TreemapNodeDto[];
}

export class QuadrantFileInfo {
  @ApiProperty({ example: 'backend/src/modules/auth/auth.service.ts' })
  filePath: string;

  @ApiProperty({ example: 420 })
  loc: number;

  @ApiProperty({ example: 18.2 })
  cyclomaticComplexity: number;

  @ApiProperty({ example: 24 })
  churnCount: number;

  @ApiProperty({ example: 5 })
  debtCount: number;

  @ApiProperty({ example: 0.72 })
  defectProbability: number;

  @ApiProperty({ example: 'CRITICAL' })
  riskLevel: string;

  @ApiProperty({ enum: ['DANGER_ZONE', 'STABLE_COMPLEX', 'ACTIVE_SIMPLE', 'HEALTHY'], example: 'DANGER_ZONE' })
  quadrant: 'DANGER_ZONE' | 'STABLE_COMPLEX' | 'ACTIVE_SIMPLE' | 'HEALTHY';
}

export class RepositoryTreemapResponseDto {
  @ApiProperty({ example: 'c64a59f6-16e0-410a-b333-e07503da0264' })
  repositoryId: string;

  @ApiProperty({ example: 48 })
  totalFiles: number;

  @ApiProperty({ example: 12540 })
  totalLoc: number;

  @ApiProperty({ example: 9.4 })
  averageComplexity: number;

  @ApiProperty({ type: () => TreemapNodeDto })
  root: TreemapNodeDto;

  @ApiProperty({
    example: { dangerZone: 4, stableComplex: 6, activeSimple: 12, healthy: 26 },
  })
  quadrantCounts: {
    dangerZone: number;
    stableComplex: number;
    activeSimple: number;
    healthy: number;
  };

  @ApiProperty({ type: () => [QuadrantFileInfo] })
  quadrantFiles: QuadrantFileInfo[];
}
