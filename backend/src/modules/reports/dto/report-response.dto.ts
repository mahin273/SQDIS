import { IsEnum, IsOptional, IsDateString, IsUUID, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ReportType, ReportScope, ReportStatus } from '../constants';

/**
 * DTO for report response
 */
export class ReportResponseDto {
  id!: string;
  type!: ReportType;
  scope!: ReportScope;
  status!: ReportStatus;
  title!: string;
  filename?: string;
  filePath?: string;
  fileSize?: number;
  startDate!: Date;
  endDate!: Date;
  organizationId!: string;
  teamId?: string;
  projectId?: string;
  repositoryId?: string;
  developerId?: string;
  createdAt!: Date;
  completedAt?: Date;
  errorMessage?: string;
  downloadUrl?: string;
}

/**
 * DTO for paginated report list
 */
export class ReportListResponseDto {
  reports!: ReportResponseDto[];
  total!: number;
  page!: number;
  limit!: number;
  totalPages!: number;
}

/**
 * DTO for report filters
 * Supports report type, date range, and repository filters
 */
export class ReportFiltersDto {
  @IsOptional()
  @IsEnum(ReportType)
  type?: ReportType;

  @IsOptional()
  @IsEnum(ReportScope)
  scope?: ReportScope;

  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsUUID()
  teamId?: string;

  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsUUID()
  repositoryId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
