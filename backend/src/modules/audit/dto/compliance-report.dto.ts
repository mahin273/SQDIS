import { IsEnum, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export enum ComplianceReportType {
  SOC2 = 'SOC2',
  GDPR = 'GDPR',
  HIPAA = 'HIPAA',
}

/**
 * DTO for generating compliance reports
 */
export class GenerateComplianceReportDto {
  @ApiProperty({
    description: 'Type of compliance report to generate',
    enum: ComplianceReportType,
    example: ComplianceReportType.SOC2,
  })
  @IsEnum(ComplianceReportType)
  reportType: ComplianceReportType;

  @ApiProperty({
    description: 'Start date for the report period (ISO 8601 format)',
    example: '2024-01-01T00:00:00Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({
    description: 'End date for the report period (ISO 8601 format)',
    example: '2024-12-31T23:59:59Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
