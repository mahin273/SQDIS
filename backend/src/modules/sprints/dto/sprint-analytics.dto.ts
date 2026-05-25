import { IsString, IsNumber, IsOptional, IsArray, IsEnum, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// Sprint Velocity
export class SprintVelocityDto {
  @ApiProperty()
  sprintId!: string;

  @ApiProperty()
  sprintName!: string;

  @ApiProperty()
  totalCommits!: number;

  @ApiProperty()
  featureCommits!: number;

  @ApiProperty()
  avgDQS!: number;

  @ApiProperty()
  startDate!: Date;

  @ApiProperty()
  endDate!: Date;
}

export class VelocityTrendDto {
  @ApiProperty({ type: [SprintVelocityDto] })
  sprints!: SprintVelocityDto[];

  @ApiProperty()
  avgVelocity!: number;

  @ApiProperty()
  velocityTrend!: 'increasing' | 'decreasing' | 'stable';

  @ApiProperty()
  predictedNextVelocity!: number;
}

// Sprint Burndown
export class BurndownDataPointDto {
  @ApiProperty()
  date!: string;

  @ApiProperty()
  idealRemaining!: number;

  @ApiProperty()
  actualRemaining!: number;

  @ApiProperty()
  completed!: number;
}

export class SprintBurndownDto {
  @ApiProperty()
  sprintId!: string;

  @ApiProperty()
  totalWork!: number;

  @ApiProperty()
  completedWork!: number;

  @ApiProperty()
  remainingWork!: number;

  @ApiProperty({ type: [BurndownDataPointDto] })
  burndownData!: BurndownDataPointDto[];

  @ApiProperty()
  projectedCompletion!: string | null;

  @ApiProperty()
  isOnTrack!: boolean;
}

// Sprint Health
export class SprintHealthDto {
  @ApiProperty()
  sprintId!: string;

  @ApiProperty()
  overallHealth!: 'healthy' | 'at_risk' | 'critical';

  @ApiProperty()
  healthScore!: number;

  @ApiProperty()
  indicators!: {
    bugIntroductionRate: { value: number; status: 'good' | 'warning' | 'critical' };
    dqsTrend: { value: number; status: 'good' | 'warning' | 'critical' };
    reviewTurnaround: { value: number; status: 'good' | 'warning' | 'critical' };
    codeChurn: { value: number; status: 'good' | 'warning' | 'critical' };
    commitFrequency: { value: number; status: 'good' | 'warning' | 'critical' };
  };

  @ApiProperty()
  recommendations!: string[];
}

// Sprint Goals
export enum SprintMetricType {
  DQS = 'DQS',
  COMMITS = 'COMMITS',
  BUGS_FIXED = 'BUGS_FIXED',
  BUG_REDUCTION = 'BUG_REDUCTION',
  COVERAGE = 'COVERAGE',
  FEATURE_COMMITS = 'FEATURE_COMMITS',
}

export enum SprintGoalStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  ACHIEVED = 'ACHIEVED',
  FAILED = 'FAILED',
}

export class CreateSprintGoalDto {
  @ApiProperty()
  @IsString()
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: SprintMetricType })
  @IsEnum(SprintMetricType)
  metricType!: SprintMetricType;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  targetValue!: number;
}

export class SprintGoalDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  sprintId!: string;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional()
  description?: string | null;

  @ApiProperty({ enum: SprintMetricType })
  metricType!: SprintMetricType;

  @ApiProperty()
  targetValue!: number;

  @ApiProperty()
  currentValue!: number;

  @ApiProperty()
  progress!: number;

  @ApiProperty({ enum: SprintGoalStatus })
  status!: SprintGoalStatus | string;
}

// Developer Contributions
export class DeveloperContributionDto {
  @ApiProperty()
  developerId!: string;

  @ApiProperty()
  developerName!: string;

  @ApiProperty()
  avatarUrl!: string | null;

  @ApiProperty()
  totalCommits!: number;

  @ApiProperty()
  featureCommits!: number;

  @ApiProperty()
  bugfixCommits!: number;

  @ApiProperty()
  reviewsGiven!: number;

  @ApiProperty()
  reviewsReceived!: number;

  @ApiProperty()
  avgDQS!: number;

  @ApiProperty()
  linesAdded!: number;

  @ApiProperty()
  linesDeleted!: number;
}

export class SprintContributionsDto {
  @ApiProperty()
  sprintId!: string;

  @ApiProperty({ type: [DeveloperContributionDto] })
  contributions!: DeveloperContributionDto[];

  @ApiProperty()
  totalCommits!: number;

  @ApiProperty()
  totalReviews!: number;
}

// Sprint Retrospective
export class CreateRetrospectiveDto {
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  wentWell?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  needsImprovement?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  actionItems?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class SprintRetrospectiveDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  sprintId!: string;

  @ApiProperty({ type: [String] })
  wentWell!: string[];

  @ApiProperty({ type: [String] })
  needsImprovement!: string[];

  @ApiProperty({ type: [String] })
  actionItems!: string[];

  @ApiPropertyOptional()
  notes?: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

// Sprint Carry-Over
export class CreateCarryOverDto {
  @ApiProperty()
  @IsString()
  toSprintId!: string;

  @ApiProperty()
  @IsString()
  description!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

export class SprintCarryOverDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  fromSprintId!: string;

  @ApiProperty()
  fromSprintName!: string;

  @ApiProperty()
  toSprintId!: string;

  @ApiProperty()
  toSprintName!: string;

  @ApiProperty()
  description!: string;

  @ApiPropertyOptional()
  reason?: string;

  @ApiProperty()
  createdAt!: Date;
}

// Sprint Timeline
export class SprintTimelineDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  teamId!: string;

  @ApiProperty()
  teamName!: string;

  @ApiProperty()
  startDate!: Date;

  @ApiProperty()
  endDate!: Date;

  @ApiProperty()
  status!: 'planned' | 'active' | 'completed';

  @ApiProperty()
  progress!: number;

  @ApiProperty()
  avgDQS!: number;
}

export class SprintTimelineResponseDto {
  @ApiProperty({ type: [SprintTimelineDto] })
  sprints!: SprintTimelineDto[];

  @ApiProperty()
  teams!: { id: string; name: string; color: string }[];

  @ApiProperty()
  dateRange!: { start: Date; end: Date };
}
