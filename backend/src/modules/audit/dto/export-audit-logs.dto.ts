import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsDateString, IsArray } from 'class-validator';
import { Transform } from 'class-transformer';
import { ExportFormat, AuditSeverity } from '@prisma/client';

/**
 * DTO for exporting audit logs
 */
export class ExportAuditLogsDto {
  @ApiProperty({ description: 'Export format', enum: ExportFormat })
  @IsEnum(ExportFormat)
  format: ExportFormat;

  @ApiPropertyOptional({ description: 'Filter by user ID' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: 'Filter by action type', isArray: true })
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : [value]))
  @IsArray()
  @IsString({ each: true })
  action?: string[];

  @ApiPropertyOptional({ description: 'Filter by resource type' })
  @IsOptional()
  @IsString()
  resourceType?: string;

  @ApiPropertyOptional({ description: 'Filter by resource ID' })
  @IsOptional()
  @IsString()
  resourceId?: string;

  @ApiPropertyOptional({ description: 'Filter by start date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'Filter by end date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Filter by severity', enum: AuditSeverity })
  @IsOptional()
  @IsEnum(AuditSeverity)
  severity?: AuditSeverity;
}
