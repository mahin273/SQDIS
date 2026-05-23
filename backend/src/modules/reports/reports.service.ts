/* eslint-disable*/
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma';
import { CreateReportDto, ReportResponseDto, ReportListResponseDto, ReportFiltersDto } from './dto';
import { REPORT_QUEUE, ReportType, ReportScope, ReportStatus } from './constants';
import { FileStorageService } from './services/file-storage.service';

/**
 * Service for report generation and management
 */
@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(REPORT_QUEUE) private readonly reportQueue: Queue,
    private readonly fileStorageService: FileStorageService,
  ) {}

  /**
   * Create a new report and enqueue generation job
   */
  async createReport(
    dto: CreateReportDto,
    organizationId: string,
    userId: string,
  ): Promise<ReportResponseDto> {
    this.logger.debug(`Creating report for organization ${organizationId}`);

    // Validate date range
    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);

    if (endDate <= startDate) {
      throw new BadRequestException('End date must be after start date');
    }

    // Validate scope-specific requirements
    await this.validateReportScope(dto, organizationId);

    // Generate title if not provided
    const title = dto.title || this.generateReportTitle(dto);

    // Create report record
    const report = await this.prisma.report.create({
      data: {
        type: dto.type,
        scope: dto.scope,
        status: ReportStatus.PENDING,
        title,
        startDate,
        endDate,
        organizationId,
        teamId: dto.teamId,
        projectId: dto.projectId,
        repositoryId: dto.repositoryId,
        developerId: dto.developerId,
        createdById: userId,
      },
    });

    // Enqueue report generation job
    await this.reportQueue.add(
      'generate-report',
      {
        reportId: report.id,
        type: dto.type,
        scope: dto.scope,
        organizationId,
        teamId: dto.teamId,
        projectId: dto.projectId,
        repositoryId: dto.repositoryId,
        developerId: dto.developerId,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      {
        jobId: `report-${report.id}`,
      },
    );

    this.logger.log(`Report ${report.id} created and queued for generation`);

    return this.formatReportResponse(report);
  }

  /**
   * Get all reports for an organization with filters
   */
  async findAll(organizationId: string, filters: ReportFiltersDto): Promise<ReportListResponseDto> {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      organizationId,
    };

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.scope) {
      where.scope = filters.scope;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.teamId) {
      where.teamId = filters.teamId;
    }

    if (filters.projectId) {
      where.projectId = filters.projectId;
    }

    if (filters.repositoryId) {
      where.repositoryId = filters.repositoryId;
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.createdAt.lte = new Date(filters.endDate);
      }
    }

    const [reports, total] = await Promise.all([
      this.prisma.report.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.report.count({ where }),
    ]);

    return {
      reports: reports.map((r) => this.formatReportResponse(r)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get report by ID
   */
  async findById(id: string, organizationId: string): Promise<ReportResponseDto> {
    const report = await this.prisma.report.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    return this.formatReportResponse(report);
  }

  /**
   * Get download URL for a completed report
   */
  async getDownloadUrl(id: string, organizationId: string): Promise<string> {
    const report = await this.prisma.report.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    if (report.status !== ReportStatus.COMPLETED) {
      throw new BadRequestException('Report is not ready for download');
    }

    if (!report.filePath) {
      throw new BadRequestException('Report file not found');
    }

    return this.fileStorageService.getFilePath(report.filePath);
  }

  /**
   * Update report status
   */
  async updateStatus(
    id: string,
    status: ReportStatus,
    data?: { filename?: string; filePath?: string; fileSize?: number; errorMessage?: string },
  ): Promise<void> {
    const updateData: any = {
      status,
    };

    if (status === ReportStatus.COMPLETED) {
      updateData.completedAt = new Date();
    }

    if (data?.filename) {
      updateData.filename = data.filename;
    }

    if (data?.filePath) {
      updateData.filePath = data.filePath;
    }

    if (data?.fileSize) {
      updateData.fileSize = data.fileSize;
    }

    if (data?.errorMessage) {
      updateData.errorMessage = data.errorMessage;
    }

    await this.prisma.report.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Retry a failed report generation
   */
  async retryFailedReport(id: string, organizationId: string): Promise<ReportResponseDto> {
    const report = await this.prisma.report.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    if (report.status !== ReportStatus.FAILED) {
      throw new BadRequestException('Only failed reports can be retried');
    }

    // Reset status and clear error
    await this.prisma.report.update({
      where: { id },
      data: {
        status: ReportStatus.PENDING,
        errorMessage: null,
        completedAt: null,
      },
    });

    // Re-enqueue the job
    await this.reportQueue.add(
      'generate-report',
      {
        reportId: report.id,
        type: report.type,
        scope: report.scope,
        organizationId,
        teamId: report.teamId,
        projectId: report.projectId,
        repositoryId: report.repositoryId,
        developerId: report.developerId,
        startDate: report.startDate.toISOString(),
        endDate: report.endDate.toISOString(),
      },
      {
        jobId: `report-retry-${report.id}-${Date.now()}`,
      },
    );

    this.logger.log(`Report ${id} queued for retry`);

    const updatedReport = await this.prisma.report.findUnique({
      where: { id },
    });

    return this.formatReportResponse(updatedReport);
  }

  /**
   * Delete a report
   */
  async delete(id: string, organizationId: string): Promise<void> {
    const report = await this.prisma.report.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    // Delete file if exists
    if (report.filePath) {
      await this.fileStorageService.deleteFile(report.filePath);
    }

    await this.prisma.report.delete({
      where: { id },
    });
  }

  /**
   * Validate report scope requirements
   */
  private async validateReportScope(dto: CreateReportDto, organizationId: string): Promise<void> {
    switch (dto.scope) {
      case ReportScope.TEAM: {
        if (!dto.teamId) {
          throw new BadRequestException('Team ID is required for team scope reports');
        }
        const team = await this.prisma.team.findFirst({
          where: { id: dto.teamId, organizationId, isActive: true },
        });
        if (!team) {
          throw new NotFoundException('Team not found');
        }
        break;
      }

      case ReportScope.PROJECT: {
        if (!dto.projectId) {
          throw new BadRequestException('Project ID is required for project scope reports');
        }
        const project = await this.prisma.project.findFirst({
          where: { id: dto.projectId, organizationId },
        });
        if (!project) {
          throw new NotFoundException('Project not found');
        }
        break;
      }

      case ReportScope.DEVELOPER: {
        if (!dto.developerId) {
          throw new BadRequestException('Developer ID is required for developer scope reports');
        }
        const member = await this.prisma.organizationMember.findFirst({
          where: { userId: dto.developerId, organizationId },
        });
        if (!member) {
          throw new NotFoundException('Developer not found in organization');
        }
        break;
      }
    }
  }

  /**
   * Generate report title based on scope and type
   */
  private generateReportTitle(dto: CreateReportDto): string {
    const typeLabel = dto.type === ReportType.PDF ? 'PDF Report' : 'CSV Export';
    const scopeLabel = dto.scope.charAt(0) + dto.scope.slice(1).toLowerCase();
    const dateRange = `${new Date(dto.startDate).toLocaleDateString()} - ${new Date(dto.endDate).toLocaleDateString()}`;
    return `${scopeLabel} ${typeLabel} (${dateRange})`;
  }

  /**
   * Format report response
   */
  private formatReportResponse(report: any): ReportResponseDto {
    const response: ReportResponseDto = {
      id: report.id,
      type: report.type,
      scope: report.scope,
      status: report.status,
      title: report.title,
      filename: report.filename,
      filePath: report.filePath,
      fileSize: report.fileSize,
      startDate: report.startDate,
      endDate: report.endDate,
      organizationId: report.organizationId,
      teamId: report.teamId,
      projectId: report.projectId,
      repositoryId: report.repositoryId,
      developerId: report.developerId,
      createdAt: report.createdAt,
      completedAt: report.completedAt,
      errorMessage: report.errorMessage,
    };

    if (report.status === ReportStatus.COMPLETED && report.filePath) {
      response.downloadUrl = `/api/reports/${report.id}/download`;
    }

    return response;
  }
}
