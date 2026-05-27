import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  Min,
  Max,
  IsDateString,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CoverageFormat, CoverageStatus } from '../constants';

/**
 * DTO for coverage report filters
 */
export class CoverageFiltersDto {
  @ApiPropertyOptional({ description: 'Repository ID' })
  @IsOptional()
  @IsString()
  repositoryId?: string;

  @ApiPropertyOptional({ enum: CoverageStatus, description: 'Coverage status' })
  @IsOptional()
  @IsEnum(CoverageStatus)
  status?: CoverageStatus;

  @ApiPropertyOptional({ enum: CoverageFormat, description: 'Coverage format' })
  @IsOptional()
  @IsEnum(CoverageFormat)
  format?: CoverageFormat;

  @ApiPropertyOptional({ description: 'Branch name' })
  @IsOptional()
  @IsString()
  branch?: string;

  @ApiPropertyOptional({ description: 'Commit SHA' })
  @IsOptional()
  @IsString()
  commitSha?: string;

  @ApiPropertyOptional({ description: 'Start date filter' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date filter' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}

/**
 * DTO for coverage module response
 */
export class CoverageModuleDto {
  @ApiProperty({ description: 'Module ID' })
  id: string;

  @ApiProperty({ description: 'Module path' })
  modulePath: string;

  @ApiProperty({ description: 'Total lines in module' })
  linesTotal: number;

  @ApiProperty({ description: 'Covered lines in module' })
  linesCovered: number;

  @ApiProperty({ description: 'Coverage percentage for module' })
  coveragePercentage: number;
}

/**
 * DTO for repository info in coverage response
 */
export class RepositoryInfoDto {
  @ApiProperty({ description: 'Repository ID' })
  id: string;

  @ApiProperty({ description: 'Repository name' })
  name: string;

  @ApiProperty({ description: 'Repository full name' })
  fullName: string;
}

/**
 * DTO for coverage report response
 */
export class CoverageResponseDto {
  @ApiProperty({ description: 'Coverage report ID' })
  id: string;

  @ApiProperty({ description: 'Repository ID' })
  repositoryId: string;

  @ApiPropertyOptional({ type: RepositoryInfoDto, description: 'Repository info' })
  repository?: RepositoryInfoDto;

  @ApiProperty({ enum: CoverageFormat, description: 'Coverage format' })
  format: CoverageFormat;

  @ApiProperty({ enum: CoverageStatus, description: 'Processing status' })
  status: CoverageStatus;

  @ApiProperty({ description: 'Original filename' })
  originalFilename: string;

  @ApiProperty({ description: 'File size in bytes' })
  fileSize: number;

  @ApiProperty({ description: 'SHA-256 hash of file' })
  fileHash: string;

  @ApiPropertyOptional({ description: 'Commit SHA' })
  commitSha?: string;

  @ApiPropertyOptional({ description: 'Branch name' })
  branch?: string;

  @ApiPropertyOptional({ description: 'Total lines' })
  linesTotal?: number;

  @ApiPropertyOptional({ description: 'Covered lines' })
  linesCovered?: number;

  @ApiPropertyOptional({ description: 'Coverage percentage' })
  coveragePercentage?: number;

  @ApiPropertyOptional({ description: 'Previous coverage percentage' })
  previousCoveragePercentage?: number;

  @ApiPropertyOptional({ description: 'Coverage delta from previous report' })
  coverageDelta?: number;

  @ApiPropertyOptional({ description: 'Error message if processing failed' })
  errorMessage?: string;

  @ApiProperty({ description: 'Upload timestamp' })
  createdAt: Date;

  @ApiPropertyOptional({ description: 'Processing completion timestamp' })
  processedAt?: Date;

  @ApiPropertyOptional({ type: [CoverageModuleDto], description: 'Coverage modules' })
  modules?: CoverageModuleDto[];
}

/**
 * DTO for coverage list response
 */
export class CoverageListResponseDto {
  @ApiProperty({ type: [CoverageResponseDto], description: 'Coverage reports' })
  reports: CoverageResponseDto[];

  @ApiProperty({ description: 'Total count' })
  total: number;

  @ApiProperty({ description: 'Current page' })
  page: number;

  @ApiProperty({ description: 'Items per page' })
  limit: number;

  @ApiProperty({ description: 'Total pages' })
  totalPages: number;
}

/**
 * DTO for coverage trend filters
 */
export class CoverageTrendFiltersDto {
  @ApiPropertyOptional({ description: 'Branch name' })
  @IsOptional()
  @IsString()
  branch?: string;

  @ApiPropertyOptional({ description: 'Start date filter (ISO 8601 format)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'End date filter (ISO 8601 format)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of reports to return',
    default: 100,
    minimum: 1,
    maximum: 500,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;
}

/**
 * Trend statistics for coverage analysis
 * Validates: Requirements 7.1, 7.3
 */
export class TrendStatistics {
  @ApiProperty({ description: 'Minimum coverage percentage in the trend' })
  min: number;

  @ApiProperty({ description: 'Maximum coverage percentage in the trend' })
  max: number;

  @ApiProperty({ description: 'Average coverage percentage in the trend' })
  average: number;

  @ApiProperty({ description: 'Trend direction', enum: ['improving', 'declining', 'stable'] })
  trend: 'improving' | 'declining' | 'stable';
}

/**
 * DTO for coverage trend report item
 */
export class CoverageTrendReportDto {
  @ApiProperty({ description: 'Coverage report ID' })
  id: string;

  @ApiProperty({ description: 'Coverage percentage', nullable: true })
  coveragePercentage: number | null;

  @ApiProperty({ description: 'Coverage delta from previous report', nullable: true })
  coverageDelta: number | null;

  @ApiProperty({ description: 'Commit SHA', nullable: true })
  commitSha: string | null;

  @ApiProperty({ description: 'Branch name', nullable: true })
  branch: string | null;

  @ApiProperty({ description: 'Report creation timestamp' })
  createdAt: Date;
}

/**
 * DTO for coverage trend response
 * Validates: Requirements 7.1, 7.3
 */
export class CoverageTrendResponseDto {
  @ApiProperty({
    type: [CoverageTrendReportDto],
    description: 'Coverage reports in chronological order',
  })
  reports: CoverageTrendReportDto[];

  @ApiProperty({ description: 'Trend statistics' })
  statistics: TrendStatistics;
}
