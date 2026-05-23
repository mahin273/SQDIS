import { IsEnum, IsOptional, IsString, IsDateString, IsUUID } from 'class-validator';
import { ReportType, ReportScope } from '../constants';

/**
 * DTO for creating a new report
 */
export class CreateReportDto {
  @IsEnum(ReportType)
  type!: ReportType;

  @IsEnum(ReportScope)
  scope!: ReportScope;

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
  @IsUUID()
  developerId?: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsString()
  title?: string;
}
