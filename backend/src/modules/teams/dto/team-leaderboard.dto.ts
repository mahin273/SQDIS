import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

/**
 * Query parameters for team leaderboard
 * Validates: Requirements 3.7.4
 */
export class TeamLeaderboardQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by project ID',
    example: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  projectId?: string;
}

/**
 * Response DTO for team leaderboard entry
 */
export class TeamLeaderboardEntryDto {
  @ApiProperty({ description: 'Team ID' })
  teamId!: string;

  @ApiProperty({ description: 'Team name' })
  name!: string;

  @ApiProperty({
    description: 'Number of active team members',
    example: 5,
  })
  memberCount!: number;

  @ApiProperty({
    description: 'Aggregated team DQS (weighted average by commit count)',
    example: 75.5,
    nullable: true,
  })
  aggregatedDQS!: number | null;

  @ApiProperty({
    description: 'DQS trend indicator (positive = improving, negative = declining)',
    example: 2.5,
    nullable: true,
  })
  dqsTrend!: number | null;

  @ApiProperty({
    description: 'Total commits in the last 30 days',
    example: 150,
  })
  totalCommits!: number;

  @ApiProperty({
    description: 'Status indicator',
    example: 'Active',
    enum: ['Active', 'No Activity'],
  })
  status!: 'Active' | 'No Activity';

  @ApiProperty({
    description: 'Rank position in leaderboard',
    example: 1,
  })
  rank!: number;
}

/**
 * Response DTO for team leaderboard
 */
export class TeamLeaderboardResponseDto {
  @ApiProperty({
    description: 'List of teams ranked by DQS',
    type: [TeamLeaderboardEntryDto],
  })
  teams!: TeamLeaderboardEntryDto[];

  @ApiProperty({
    description: 'Total number of teams',
    example: 10,
  })
  totalTeams!: number;

  @ApiPropertyOptional({
    description: 'Project filter applied',
    example: 'uuid',
  })
  projectFilter?: string;
}
