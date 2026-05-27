import { IsOptional, IsString, IsInt, IsDateString, IsEnum, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum ReviewStateFilter {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  CHANGES_REQUESTED = 'CHANGES_REQUESTED',
  COMMENTED = 'COMMENTED',
  DISMISSED = 'DISMISSED',
}

export enum TurnaroundFilter {
  FAST = 'FAST',
  NORMAL = 'NORMAL',
  SLOW = 'SLOW',
}

export enum ReviewViewType {
  ALL = 'all',
  MY_REVIEWS = 'my_reviews',
  REVIEWS_ON_MY_PRS = 'reviews_on_my_prs',
  TEAM = 'team',
}

export class ReviewFiltersDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @IsString()
  repositoryId?: string;

  @IsOptional()
  @IsString()
  reviewerId?: string;

  @IsOptional()
  @IsString()
  prAuthorId?: string;

  @IsOptional()
  @IsEnum(ReviewStateFilter)
  state?: ReviewStateFilter;

  @IsOptional()
  @IsEnum(TurnaroundFilter)
  turnaroundClass?: TurnaroundFilter;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(ReviewViewType)
  viewType?: ReviewViewType;

  @IsOptional()
  @IsString()
  teamId?: string;
}
