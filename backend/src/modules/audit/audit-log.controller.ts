import {
  Controller,
  Get,
  Post,
  Put,
  Query,
  Body,
  Param,
  UseGuards,
  HttpStatus,
  Res,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import express from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import * as getUserDecorator from '../auth/decorators/get-user.decorator';
import { Role } from '@prisma/client';
import { EnhancedAuditLogService } from './services/enhanced-audit-log.service';
import { AuditExportService } from './services/audit-export.service';
import { AuditRetentionService } from './services/audit-retention.service';
import { AuditAnalyticsService } from './services/audit-analytics.service';
import { QueryAuditLogsDto, ExportAuditLogsDto, UpdateRetentionPolicyDto, GenerateComplianceReportDto } from './dto';
import { createReadStream } from 'fs';

/**
 * Controller for audit log queries and exports
 */
@ApiTags('Audit Logs')
@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AuditLogController {
  constructor(
    private readonly enhancedAuditLogService: EnhancedAuditLogService,
    private readonly auditExportService: AuditExportService,
    private readonly auditRetentionService: AuditRetentionService,
    private readonly auditAnalyticsService: AuditAnalyticsService,
  ) {}

  /**
   * Query audit logs with advanced filtering

   */
  @Get()
  @Roles(Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'Query audit logs with filters and pagination' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Paginated audit logs returned successfully',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have permission to access audit logs',
  })
  async queryLogs(
    @Query() queryDto: QueryAuditLogsDto,
    @getUserDecorator.GetUser() user: getUserDecorator.RequestUser,
  ) {
    // Ensure organizationId is set from the authenticated user
    if (!user.organizationId) {
      throw new Error('User must belong to an organization');
    }

    const filters = {
      userId: queryDto.userId,
      organizationId: user.organizationId, // Always filter by user's organization
      action: queryDto.action,
      resourceType: queryDto.resourceType,
      resourceId: queryDto.resourceId,
      startDate: queryDto.startDate ? new Date(queryDto.startDate) : undefined,
      endDate: queryDto.endDate ? new Date(queryDto.endDate) : undefined,
      severity: queryDto.severity,
    };

    const pagination = {
      page: queryDto.page || 1,
      pageSize: queryDto.pageSize || 50,
      sortBy: 'timestamp' as const,
      sortOrder: queryDto.sortOrder || 'desc',
    };

    return this.enhancedAuditLogService.queryLogs(filters, pagination);
  }

  /**
   * Get a single audit log entry by ID

   */
  @Get(':id')
  @Roles(Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'Get a single audit log entry by ID' })
  @ApiParam({ name: 'id', description: 'Audit log entry ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Audit log entry returned successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Audit log entry not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have permission to access this audit log',
  })
  async getLogById(
    @Param('id') id: string,
    @getUserDecorator.GetUser() user: getUserDecorator.RequestUser,
  ) {
    if (!user.organizationId) {
      throw new Error('User must belong to an organization');
    }

    return this.enhancedAuditLogService.getLogById(id, user.organizationId);
  }

  /**
   * Export audit logs to CSV or JSON format
   */
  @Post('export')
  @Roles(Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'Export audit logs to CSV or JSON' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Export initiated successfully',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have permission to export audit logs',
  })
  async exportLogs(
    @Body() exportDto: ExportAuditLogsDto,
    @getUserDecorator.GetUser() user: getUserDecorator.RequestUser,
  ) {
    if (!user.organizationId) {
      throw new Error('User must belong to an organization');
    }

    const filters = {
      userId: exportDto.userId,
      organizationId: user.organizationId,
      action: exportDto.action,
      resourceType: exportDto.resourceType,
      resourceId: exportDto.resourceId,
      startDate: exportDto.startDate ? new Date(exportDto.startDate) : undefined,
      endDate: exportDto.endDate ? new Date(exportDto.endDate) : undefined,
      severity: exportDto.severity,
    };

    const result = await this.auditExportService.exportLogs(
      filters,
      exportDto.format,
      user.id,
      user.organizationId,
    );

    // Log the export action
    await this.enhancedAuditLogService.logExport({
      userId: user.id,
      organizationId: user.organizationId,
      exportType: exportDto.format,
      scope: 'AuditLog',
      recordCount: result.estimatedRecords,
    });

    return result;
  }

  /**
   * Get export status
   */
  @Get('export/:id')
  @Roles(Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'Get export status' })
  @ApiParam({ name: 'id', description: 'Export ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Export status returned successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Export not found',
  })
  async getExportStatus(@Param('id') id: string) {
    return this.auditExportService.getExportStatus(id);
  }

  /**
   * Download export file
   */
  @Get('export/:id/download')
  @Roles(Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'Download export file' })
  @ApiParam({ name: 'id', description: 'Export ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Export file downloaded successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Export not found or expired',
  })
  async downloadExport(
    @Param('id') id: string,
    @getUserDecorator.GetUser() user: getUserDecorator.RequestUser,
    @Res({ passthrough: true }) res: express.Response,
  ) {
    // Get the download URL (validates access)
    await this.auditExportService.downloadExport(id, user.id);

    // Get the export record to find the file
    const exportStatus = await this.auditExportService.getExportStatus(id);

    if (!exportStatus.downloadUrl) {
      throw new Error('Download URL not available');
    }

    // Get the export record from database to get file path
    const exportRecord = await this.auditExportService['prisma'].auditExport.findUnique({
      where: { id },
    });

    if (!exportRecord || !exportRecord.s3Key) {
      throw new Error('Export file not found');
    }

    // Get file path and stream it
    const filePath = this.fileStorageService.getFilePath(exportRecord.s3Key);
    const fileStream = createReadStream(filePath);

    // Set response headers
    const filename = exportRecord.filename || `audit-export-${id}.${exportRecord.format.toLowerCase()}`;
    res.set({
      'Content-Type': exportRecord.format === 'CSV' ? 'text/csv' : 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });

    return new StreamableFile(fileStream);
  }

  /**
   * Get retention policy for the organization
   */
  @Get('retention-policy')
  @Roles(Role.OWNER)
  @ApiOperation({ summary: 'Get retention policy for the organization' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Retention policy returned successfully',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Only OWNER role can access retention policies',
  })
  async getRetentionPolicy(@getUserDecorator.GetUser() user: getUserDecorator.RequestUser) {
    if (!user.organizationId) {
      throw new Error('User must belong to an organization');
    }

    return this.auditRetentionService.getRetentionPolicy(user.organizationId);
  }

  /**
   * Update retention policy for the organization
   */
  @Put('retention-policy')
  @Roles(Role.OWNER)
  @ApiOperation({ summary: 'Update retention policy for the organization' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Retention policy updated successfully',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid retention policy (minimum 90 days required)',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Only OWNER role can update retention policies',
  })
  async updateRetentionPolicy(
    @Body() updateDto: UpdateRetentionPolicyDto,
    @getUserDecorator.GetUser() user: getUserDecorator.RequestUser,
  ) {
    if (!user.organizationId) {
      throw new Error('User must belong to an organization');
    }

    return this.auditRetentionService.updateRetentionPolicy(
      user.organizationId,
      updateDto,
    );
  }

  /**
   * Get action counts by type for analytics
   */
  @Get('analytics/action-counts')
  @Roles(Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'Get action counts by type for a time period' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Action counts returned successfully',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have permission to access analytics',
  })
  async getActionCounts(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @getUserDecorator.GetUser() user: getUserDecorator.RequestUser,
  ) {
    if (!user.organizationId) {
      throw new Error('User must belong to an organization');
    }

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default: 30 days ago
    const end = endDate ? new Date(endDate) : new Date(); // Default: now

    return this.auditAnalyticsService.getActionCountsByType(
      user.organizationId,
      start,
      end,
    );
  }

  /**
   * Get most active users for analytics
   */
  @Get('analytics/active-users')
  @Roles(Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'Get most active users by action count' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Active users returned successfully',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have permission to access analytics',
  })
  async getActiveUsers(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('limit') limit?: string,
    @getUserDecorator.GetUser() user: getUserDecorator.RequestUser = {} as getUserDecorator.RequestUser,
  ) {
    if (!user.organizationId) {
      throw new Error('User must belong to an organization');
    }

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    const userLimit = limit ? parseInt(limit, 10) : 10;

    return this.auditAnalyticsService.getMostActiveUsers(
      user.organizationId,
      start,
      end,
      userLimit,
    );
  }

  /**
   * Get failed permission checks for analytics
   */
  @Get('analytics/failed-permissions')
  @Roles(Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'Get failed permission checks by user' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Failed permission checks returned successfully',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have permission to access analytics',
  })
  async getFailedPermissions(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @getUserDecorator.GetUser() user: getUserDecorator.RequestUser,
  ) {
    if (!user.organizationId) {
      throw new Error('User must belong to an organization');
    }

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    return this.auditAnalyticsService.getFailedPermissionChecks(
      user.organizationId,
      start,
      end,
    );
  }

  /**
   * Get action timeline for analytics
   */
  @Get('analytics/timeline')
  @Roles(Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'Get action timeline over time' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Action timeline returned successfully',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have permission to access analytics',
  })
  async getActionTimeline(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('granularity') granularity?: 'hour' | 'day' | 'week',
    @getUserDecorator.GetUser() user: getUserDecorator.RequestUser = {} as getUserDecorator.RequestUser,
  ) {
    if (!user.organizationId) {
      throw new Error('User must belong to an organization');
    }

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    const timeGranularity = granularity || 'day';

    return this.auditAnalyticsService.getActionTimeline(
      user.organizationId,
      start,
      end,
      timeGranularity,
    );
  }

  /**
   * Get most accessed resources for analytics
   */
  @Get('analytics/top-resources')
  @Roles(Role.ADMIN, Role.OWNER)
  @ApiOperation({ summary: 'Get most frequently accessed resources' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Top resources returned successfully',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'User does not have permission to access analytics',
  })
  async getTopResources(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('limit') limit?: string,
    @getUserDecorator.GetUser() user: getUserDecorator.RequestUser = {} as getUserDecorator.RequestUser,
  ) {
    if (!user.organizationId) {
      throw new Error('User must belong to an organization');
    }

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    const resourceLimit = limit ? parseInt(limit, 10) : 10;

    return this.auditAnalyticsService.getMostAccessedResources(
      user.organizationId,
      start,
      end,
      resourceLimit,
    );
  }

  /**
   * GDPR data access - Get all audit entries for a specific user
   */
  @Get('gdpr/data-access/:userId')
  @Roles(Role.OWNER)
  @ApiOperation({ summary: 'Get all audit entries for a specific user (GDPR data access)' })
  @ApiParam({ name: 'userId', description: 'User ID to retrieve audit data for' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'All audit entries for the user returned successfully',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Only OWNER role can access GDPR data',
  })
  async getGdprDataAccess(
    @Param('userId') userId: string,
    @getUserDecorator.GetUser() user: getUserDecorator.RequestUser,
  ) {
    if (!user.organizationId) {
      throw new Error('User must belong to an organization');
    }

    // Query all audit logs for the specified user within the organization
    const filters = {
      userId,
      organizationId: user.organizationId,
    };

    const pagination = {
      page: 1,
      pageSize: 999999, // Get all records for GDPR compliance
      sortBy: 'timestamp' as const,
      sortOrder: 'asc' as const,
    };

    return this.enhancedAuditLogService.queryLogs(filters, pagination);
  }

  /**
   * GDPR anonymization - Anonymize all audit entries for a specific user
   */
  @Post('gdpr/anonymize/:userId')
  @Roles(Role.OWNER)
  @ApiOperation({ summary: 'Anonymize all audit entries for a specific user (GDPR right to be forgotten)' })
  @ApiParam({ name: 'userId', description: 'User ID to anonymize audit data for' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'User audit data anonymized successfully',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Only OWNER role can anonymize user data',
  })
  async anonymizeGdprData(
    @Param('userId') userId: string,
    @getUserDecorator.GetUser() user: getUserDecorator.RequestUser,
  ) {
    if (!user.organizationId) {
      throw new Error('User must belong to an organization');
    }

    const result = await this.enhancedAuditLogService.anonymizeUserData(
      userId,
      user.organizationId,
    );

    // Log the anonymization action
    await this.enhancedAuditLogService.logAction({
      userId: user.id,
      organizationId: user.organizationId,
      action: 'GDPR_ANONYMIZATION',
      resourceType: 'User',
      resourceId: userId,
      metadata: {
        anonymizedCount: result.anonymizedCount,
        anonymizedId: result.anonymizedId,
      },
    });

    return result;
  }

  /**
   * Generate compliance report (SOC 2, GDPR, HIPAA)
   */
  @Post('compliance/report')
  @Roles(Role.OWNER)
  @ApiOperation({ summary: 'Generate a compliance report with certification' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Compliance report generated successfully',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Only OWNER role can generate compliance reports',
  })
  async generateComplianceReport(
    @Body() reportDto: GenerateComplianceReportDto,
    @getUserDecorator.GetUser() user: getUserDecorator.RequestUser,
  ) {
    if (!user.organizationId) {
      throw new Error('User must belong to an organization');
    }

    const startDate = reportDto.startDate
      ? new Date(reportDto.startDate)
      : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // Default: 1 year ago
    const endDate = reportDto.endDate
      ? new Date(reportDto.endDate)
      : new Date(); // Default: now

    const report = await this.enhancedAuditLogService.generateComplianceReport(
      user.organizationId,
      reportDto.reportType,
      startDate,
      endDate,
    );

    // Log the report generation action
    await this.enhancedAuditLogService.logAction({
      userId: user.id,
      organizationId: user.organizationId,
      action: 'COMPLIANCE_REPORT_GENERATED',
      resourceType: 'ComplianceReport',
      resourceId: reportDto.reportType,
      metadata: {
        reportType: reportDto.reportType,
        period: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
        totalEntries: report.summary.totalEntries,
      },
    });

    return report;
  }

}
