import { IsEnum, IsOptional, IsString, IsDateString, IsUUID } from 'class-validator';
import { ReportScope } from '../constants';

/**
 * DTO for creating a PDF report
 */
export class CreatePdfReportDto {
  @IsOptional()
  @IsEnum(ReportScope)
  scope?: ReportScope = ReportScope.ORGANIZATION;

  @IsOptional()
  @IsString()
  type?: string;

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
