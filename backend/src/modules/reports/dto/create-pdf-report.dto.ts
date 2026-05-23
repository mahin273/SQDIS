import { IsEnum, IsOptional, IsString, IsDateString, IsUUID } from 'class-validator';
import { ReportScope } from '../constants';

/**
 * DTO for creating a PDF report
 */
export class CreatePdfReportDto {
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
