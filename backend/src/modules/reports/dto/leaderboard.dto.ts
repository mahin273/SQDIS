import { IsOptional, IsString, IsInt, Min, Max, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Enum for leaderboard sort fields
 */
export enum LeaderboardSortField {
  DQS = 'dqs',
  COMMIT_COUNT = 'commit_count',
  BUG_FIX_COUNT = 'bug_fix_count',
  CHURN = 'churn',
  COVERAGE = 'coverage',
  REVIEWS_GIVEN = 'reviews_given',
  PR_MERGE_RATE = 'pr_merge_rate',
  STREAK = 'streak',
}

/**
 * Enum for sort order
 */
export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

/**
 * Enum for time period filter
 */
export enum TimePeriod {
  WEEK = 'week',
  MONTH = 'month',
  QUARTER = 'quarter',
  ALL = 'all',
}

/**
 * DTO for leaderboard query filters

 */
export class LeaderboardQueryDto {
  @IsOptional()
  @IsString()
  teamId?: string;

  @IsOptional()
  @IsEnum(LeaderboardSortField)
  sortBy?: LeaderboardSortField = LeaderboardSortField.DQS;

  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.DESC;

  @IsOptional()
  @IsEnum(TimePeriod)
  period?: TimePeriod = TimePeriod.MONTH;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

/**
 * DTO for individual developer entry in leaderboard
 */
export class LeaderboardEntryDto {
  rank!: number;
  developerId!: string;
  developerName!: string;
  developerEmail!: string;
  avatarUrl!: string | null;
  dqs!: number | null;
  dqsTrend!: number | null; // Change from previous period
  commitCount!: number;
  bugFixCount!: number;
  featureCount!: number;
  refactorCount!: number;
  testCount!: number;
  docsCount!: number;
  churn!: number;
  coverage!: number;
  reviewsGiven!: number;
  reviewsReceived!: number;
  prMergeRate!: number; // Percentage of PRs merged
  avgReviewTurnaround!: number | null; // Hours
  streak!: number; // Consecutive days with commits
  teamIds!: string[];
  teamNames!: string[];
}

/**
 * DTO for leaderboard response
 */
export class LeaderboardResponseDto {
  entries!: LeaderboardEntryDto[];
  total!: number;
  page!: number;
  limit!: number;
  totalPages!: number;
  period!: TimePeriod;
  cachedAt!: Date | null;
}

/**
 * DTO for team leaderboard entry
 */
export class TeamLeaderboardEntryDto {
  rank!: number;
  teamId!: string;
  teamName!: string;
  memberCount!: number;
  avgDqs!: number | null;
  dqsTrend!: number | null;
  totalCommits!: number;
  sprintVelocity!: number | null;
  avgReviewTurnaround!: number | null; // Hours
  technicalDebtReduction!: number | null;
  goalCompletionRate!: number | null;
}

/**
 * DTO for team leaderboard response
 */
export class TeamLeaderboardResponseDto {
  entries!: TeamLeaderboardEntryDto[];
  total!: number;
  page!: number;
  limit!: number;
  totalPages!: number;
  period!: TimePeriod;
  cachedAt!: Date | null;
}
