import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsDateString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Query parameters for team metrics
 */
export class TeamMetricsQueryDto {
  @ApiPropertyOptional({
    description: 'Start date for metrics calculation (ISO 8601)',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date for metrics calculation (ISO 8601)',
    example: '2024-12-31',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Number of days for rolling metrics (default: 30)',
    example: 30,
    default: 30,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number = 30;
}

/**
 * Response DTO for team metrics
 */
export class TeamMetricsResponseDto {
  @ApiProperty({ description: 'Team ID' })
  teamId!: string;

  @ApiProperty({ description: 'Team name' })
  teamName!: string;

  @ApiProperty({
    description: 'Aggregated team DQS (weighted average by commit count)',
    example: 75.5,
    nullable: true,
  })
  aggregatedDQS!: number | null;

  @ApiProperty({
    description: 'Total number of commits by team members',
    example: 150,
  })
  totalCommits!: number;

  @ApiProperty({
    description: 'Number of bugfix commits',
    example: 25,
  })
  bugfixCommits!: number;

  @ApiProperty({
    description: 'Number of feature commits',
    example: 80,
  })
  featureCommits!: number;

  @ApiProperty({
    description: 'Number of refactor commits',
    example: 30,
  })
  refactorCommits!: number;

  @ApiProperty({
    description: 'Number of test commits',
    example: 10,
  })
  testCommits!: number;

  @ApiProperty({
    description: 'Number of docs commits',
    example: 5,
  })
  docsCommits!: number;

  @ApiProperty({
    description: 'Average code coverage percentage',
    example: 78.5,
    nullable: true,
  })
  averageCoverage!: number | null;

  @ApiProperty({
    description: 'Number of active team members',
    example: 5,
  })
  memberCount!: number;

  @ApiProperty({
    description: 'Number of members with commits in the period',
    example: 4,
  })
  activeMemberCount!: number;

  @ApiProperty({
    description: 'Individual member metrics',
    type: 'array',
  })
  memberMetrics!: MemberMetricDto[];

  @ApiProperty({
    description: 'Date range for the metrics',
  })
  dateRange!: {
    start: string;
    end: string;
  };
}

/**
 * Individual member metrics within team
 */
export class MemberMetricDto {
  @ApiProperty({ description: 'User ID' })
  userId!: string;

  @ApiProperty({ description: 'User name' })
  name!: string;

  @ApiProperty({ description: 'User email' })
  email!: string;

  @ApiProperty({
    description: 'Latest DQS score',
    example: 82.5,
    nullable: true,
  })
  dqsScore!: number | null;

  @ApiProperty({
    description: 'Number of commits in the period',
    example: 30,
  })
  commitCount!: number;

  @ApiProperty({
    description: 'Weight used in DQS calculation (based on commit count)',
    example: 0.2,
  })
  weight!: number;
}
