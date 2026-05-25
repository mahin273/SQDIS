import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for commit classification breakdown in sprint report
 */
export class CommitClassificationBreakdownDto {
  @ApiProperty({ description: 'Number of bugfix commits' })
  bugfix!: number;

  @ApiProperty({ description: 'Number of feature commits' })
  feature!: number;

  @ApiProperty({ description: 'Number of refactor commits' })
  refactor!: number;

  @ApiProperty({ description: 'Number of test commits' })
  test!: number;

  @ApiProperty({ description: 'Number of docs commits' })
  docs!: number;

  @ApiProperty({ description: 'Number of unclassified commits' })
  unclassified!: number;
}

/**
 * DTO for bug metrics in sprint report
 */
export class BugMetricsDto {
  @ApiProperty({ description: 'Number of bugs introduced (bugfix commits indicate bugs existed)' })
  bugsIntroduced!: number;

  @ApiProperty({ description: 'Number of bugs fixed (bugfix commits)' })
  bugsFixed!: number;

  @ApiProperty({ description: 'Bug debt (introduced - fixed)' })
  bugDebt!: number;
}

/**
 * DTO for quality metrics in sprint report
 */
export class QualityMetricsDto {
  @ApiProperty({ description: 'Average DQS score of team members' })
  avgDQS!: number;

  @ApiProperty({ description: 'Coverage percentage' })
  coveragePct!: number;
}

/**
 * DTO for sprint report response
 */
export class SprintReportDto {
  @ApiProperty({ description: 'Sprint report ID' })
  id!: string;

  @ApiProperty({ description: 'Sprint ID' })
  sprintId!: string;

  @ApiProperty({ description: 'Total number of commits in the sprint' })
  totalCommits!: number;

  @ApiProperty({
    description: 'Commit classification breakdown',
    type: CommitClassificationBreakdownDto,
  })
  classificationBreakdown!: CommitClassificationBreakdownDto;

  @ApiProperty({ description: 'Bug metrics', type: BugMetricsDto })
  bugMetrics!: BugMetricsDto;

  @ApiProperty({ description: 'Quality metrics', type: QualityMetricsDto })
  qualityMetrics!: QualityMetricsDto;

  @ApiProperty({ description: 'Report generation timestamp' })
  generatedAt!: Date;
}

/**
 * DTO for sprint comparison request
 */
export class SprintCompareQueryDto {
  @ApiProperty({
    description: 'Sprint IDs to compare (comma-separated)',
    example: 'sprint-id-1,sprint-id-2',
  })
  sprintIds!: string;
}

/**
 * DTO for metric change indicator
 */
export class MetricChangeDto {
  @ApiProperty({ description: 'Current value' })
  current!: number;

  @ApiProperty({ description: 'Previous value' })
  previous!: number;

  @ApiProperty({ description: 'Percentage change' })
  changePercent!: number;

  @ApiProperty({ description: 'Direction indicator', enum: ['up', 'down', 'unchanged'] })
  direction!: 'up' | 'down' | 'unchanged';

  @ApiProperty({ description: 'Whether the change is positive (green) or negative (red)' })
  isPositive!: boolean;
}

/**
 * DTO for sprint comparison result
 */
export class SprintComparisonDto {
  @ApiProperty({ description: 'Sprint ID' })
  sprintId!: string;

  @ApiProperty({ description: 'Sprint name' })
  sprintName!: string;

  @ApiProperty({ description: 'Sprint start date' })
  startDate!: Date;

  @ApiProperty({ description: 'Sprint end date' })
  endDate!: Date;

  @ApiProperty({ description: 'Total commits' })
  totalCommits!: number;

  @ApiProperty({ description: 'Bugfix commits' })
  bugfixCommits!: number;

  @ApiProperty({ description: 'Feature commits' })
  featureCommits!: number;

  @ApiProperty({ description: 'Bugs introduced' })
  bugsIntroduced!: number;

  @ApiProperty({ description: 'Bugs fixed' })
  bugsFixed!: number;

  @ApiProperty({ description: 'Average DQS' })
  avgDQS!: number;

  @ApiProperty({ description: 'Coverage percentage' })
  coveragePct!: number;
}

/**
 * DTO for sprint comparison response with changes
 */
export class SprintCompareResponseDto {
  @ApiProperty({ description: 'Sprints being compared', type: [SprintComparisonDto] })
  sprints!: SprintComparisonDto[];

  @ApiPropertyOptional({ description: 'Metric changes between sprints (if comparing 2 sprints)' })
  changes?: {
    totalCommits: MetricChangeDto;
    bugfixCommits: MetricChangeDto;
    featureCommits: MetricChangeDto;
    bugsIntroduced: MetricChangeDto;
    bugsFixed: MetricChangeDto;
    avgDQS: MetricChangeDto;
    coveragePct: MetricChangeDto;
  };
}
