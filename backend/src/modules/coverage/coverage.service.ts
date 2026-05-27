import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { createHash } from 'crypto';
import { readFileSync, unlinkSync, existsSync } from 'fs';
import { PrismaService } from '../../prisma';
import {
  CoverageResponseDto,
  CoverageListResponseDto,
  CoverageFiltersDto,
  CoverageModuleDto,
  CoverageTrendFiltersDto,
  CoverageTrendResponseDto,
  TrendStatistics,
} from './dto';
import { COVERAGE_QUEUE, CoverageFormat, CoverageStatus } from './constants';

/**
 * Service for coverage report management
 */
@Injectable()
export class CoverageService {
  private readonly logger = new Logger(CoverageService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(COVERAGE_QUEUE) private readonly coverageQueue: Queue,
  ) {}

  /**
   * Upload and process a coverage report
   */
  async uploadCoverage(
    file: Express.Multer.File,
    repositoryId: string,
    organizationId: string,
    uploadedById: string,
    commitSha?: string,
    branch?: string,
  ): Promise<CoverageResponseDto> {
    this.logger.debug(`Uploading coverage for repository ${repositoryId}`);

    // Validate commitSha format if provided
    if (commitSha && !/^[0-9a-fA-F]{40}$/.test(commitSha)) {
      throw new BadRequestException('Invalid commitSha format: must be 40 hexadecimal characters');
    }

    // Verify repository belongs to organization
    const repository = await this.prisma.repository.findFirst({
      where: {
        id: repositoryId,
        organizationId,
      },
    });

    if (!repository) {
      throw new NotFoundException('Repository not found');
    }

    // Detect format from file content/extension
    const format = this.detectFormat(file);
    this.logger.debug(`Detected coverage format: ${format}`);

    // Compute SHA-256 hash of file
    const fileContent = readFileSync(file.path);
    const fileHash = createHash('sha256').update(fileContent).digest('hex');

    // Check for duplicate upload
    const existingReport = await this.prisma.coverageReport.findFirst({
      where: {
        repositoryId,
        fileHash,
      },
    });

    if (existingReport) {
      // Clean up uploaded file
      if (existsSync(file.path)) {
        unlinkSync(file.path);
      }
      throw new BadRequestException('Duplicate coverage report already exists');
    }

    // Create coverage report record
    const report = await this.prisma.coverageReport.create({
      data: {
        repositoryId,
        uploadedById,
        format,
        status: CoverageStatus.PENDING,
        originalFilename: file.originalname,
        filePath: file.path,
        fileSize: file.size,
        fileHash,
        commitSha,
        branch,
      },
    });

    // Enqueue parsing job
    await this.coverageQueue.add(
      'parse-coverage',
      {
        reportId: report.id,
        filePath: file.path,
        format,
        repositoryId,
        organizationId,
      },
      {
        jobId: `coverage-${report.id}`,
      },
    );

    this.logger.log(`Coverage report ${report.id} created and queued for parsing`);

    return this.formatResponse(report);
  }

  /**
   * Get all coverage reports for an organization
   */
  async findAll(
    organizationId: string,
    filters: CoverageFiltersDto,
  ): Promise<CoverageListResponseDto> {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      repository: {
        organizationId,
      },
    };

    if (filters.repositoryId) {
      where.repositoryId = filters.repositoryId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.format) {
      where.format = filters.format;
    }

    if (filters.branch) {
      where.branch = filters.branch;
    }

    if (filters.commitSha) {
      where.commitSha = filters.commitSha;
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
      this.prisma.coverageReport.findMany({
        where,
        include: {
          repository: {
            select: {
              id: true,
              name: true,
              fullName: true,
            },
          },
          modules: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.coverageReport.count({ where }),
    ]);

    return {
      reports: reports.map((r) => this.formatResponse(r)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get coverage report by ID
   */
  async findById(id: string, organizationId: string): Promise<CoverageResponseDto> {
    const report = await this.prisma.coverageReport.findFirst({
      where: {
        id,
        repository: {
          organizationId,
        },
      },
      include: {
        repository: {
          select: {
            id: true,
            name: true,
            fullName: true,
          },
        },
        modules: true,
      },
    });

    if (!report) {
      throw new NotFoundException('Coverage report not found');
    }

    return this.formatResponse(report);
  }

  /**
   * Get latest coverage report for a repository
   */
  async findLatest(repositoryId: string, organizationId: string): Promise<CoverageResponseDto> {
    const report = await this.prisma.coverageReport.findFirst({
      where: {
        repositoryId,
        repository: {
          organizationId,
        },
        status: CoverageStatus.COMPLETED,
      },
      include: {
        repository: {
          select: {
            id: true,
            name: true,
            fullName: true,
          },
        },
        modules: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!report) {
      throw new NotFoundException('No coverage report found for this repository');
    }

    return this.formatResponse(report);
  }

  /**
   * Update coverage report status and metrics
   */
  async updateReport(
    id: string,
    data: {
      status?: CoverageStatus;
      linesTotal?: number;
      linesCovered?: number;
      coveragePercentage?: number;
      previousCoveragePercentage?: number;
      coverageDelta?: number;
      errorMessage?: string;
    },
  ): Promise<void> {
    const updateData: any = {};

    if (data.status) {
      updateData.status = data.status;
      if (data.status === CoverageStatus.COMPLETED) {
        updateData.processedAt = new Date();
      }
    }

    if (data.linesTotal !== undefined) {
      updateData.linesTotal = data.linesTotal;
    }

    if (data.linesCovered !== undefined) {
      updateData.linesCovered = data.linesCovered;
    }

    if (data.coveragePercentage !== undefined) {
      updateData.coveragePercentage = data.coveragePercentage;
    }

    if (data.previousCoveragePercentage !== undefined) {
      updateData.previousCoveragePercentage = data.previousCoveragePercentage;
    }

    if (data.coverageDelta !== undefined) {
      updateData.coverageDelta = data.coverageDelta;
    }

    if (data.errorMessage) {
      updateData.errorMessage = data.errorMessage;
    }

    await this.prisma.coverageReport.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Create coverage modules with batching for large reports
   */
  async createModules(
    reportId: string,
    modules: Array<{
      modulePath: string;
      linesTotal: number;
      linesCovered: number;
      coveragePercentage: number;
    }>,
  ): Promise<void> {
    const BATCH_SIZE = 500;

    // If small number of modules, insert all at once
    if (modules.length <= BATCH_SIZE) {
      await this.prisma.coverageModule.createMany({
        data: modules.map((m) => ({
          reportId,
          modulePath: m.modulePath,
          linesTotal: m.linesTotal,
          linesCovered: m.linesCovered,
          coveragePercentage: m.coveragePercentage,
        })),
      });
      return;
    }

    // For large reports, batch the inserts
    this.logger.log(`Batching ${modules.length} modules in groups of ${BATCH_SIZE}`);

    for (let i = 0; i < modules.length; i += BATCH_SIZE) {
      const batch = modules.slice(i, i + BATCH_SIZE);
      await this.prisma.coverageModule.createMany({
        data: batch.map((m) => ({
          reportId,
          modulePath: m.modulePath,
          linesTotal: m.linesTotal,
          linesCovered: m.linesCovered,
          coveragePercentage: m.coveragePercentage,
        })),
      });

      this.logger.debug(
        `Inserted batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(modules.length / BATCH_SIZE)}`,
      );
    }

    this.logger.log(`Successfully inserted ${modules.length} modules`);
  }

  /**
   * Get previous coverage percentage for delta calculation
   */
  async getPreviousCoverage(
    repositoryId: string,
    excludeId: string,
    branch?: string,
  ): Promise<number | null> {
    const where: any = {
      repositoryId,
      id: { not: excludeId },
      status: CoverageStatus.COMPLETED,
    };

    // Filter by branch when provided for branch-aware delta calculation
    if (branch) {
      where.branch = branch;
    }

    const previousReport = await this.prisma.coverageReport.findFirst({
      where,
      orderBy: { createdAt: 'desc' },
      select: { coveragePercentage: true },
    });

    return previousReport?.coveragePercentage ?? null;
  }

  /**
   * Get coverage trends for a repository
   */
  async getCoverageTrends(
    repositoryId: string,
    organizationId: string,
    filters: CoverageTrendFiltersDto,
  ): Promise<CoverageTrendResponseDto> {
    // Build query with filters
    const where: any = {
      repositoryId,
      repository: {
        organizationId,
      },
      status: CoverageStatus.COMPLETED,
    };

    // Apply branch filter
    if (filters.branch) {
      where.branch = filters.branch;
    }

    // Apply date range filters
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.createdAt.lte = new Date(filters.endDate);
      }
    }

    // Query reports ordered by createdAt ascending
    const reports = await this.prisma.coverageReport.findMany({
      where,
      select: {
        id: true,
        coveragePercentage: true,
        coverageDelta: true,
        commitSha: true,
        branch: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
      take: filters.limit || 100,
    });

    // Calculate trend statistics
    const coverageValues = reports
      .map((r) => r.coveragePercentage)
      .filter((v): v is number => v !== null);

    const statistics = this.calculateTrendStats(coverageValues);

    return {
      reports: reports.map((r) => ({
        id: r.id,
        coveragePercentage: r.coveragePercentage,
        coverageDelta: r.coverageDelta,
        commitSha: r.commitSha,
        branch: r.branch,
        createdAt: r.createdAt,
      })),
      statistics,
    };
  }

  /**
   * Calculate trend statistics from coverage values
   */
  private calculateTrendStats(values: number[]): TrendStatistics {
    if (values.length === 0) {
      return {
        min: 0,
        max: 0,
        average: 0,
        trend: 'stable',
      };
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const average = values.reduce((sum, v) => sum + v, 0) / values.length;

    // Calculate trend: compare first half to second half
    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (values.length >= 4) {
      const midpoint = Math.floor(values.length / 2);
      const firstHalf = values.slice(0, midpoint);
      const secondHalf = values.slice(midpoint);

      const firstAvg = firstHalf.reduce((sum, v) => sum + v, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, v) => sum + v, 0) / secondHalf.length;

      const diff = secondAvg - firstAvg;
      if (diff > 1) {
        trend = 'improving';
      } else if (diff < -1) {
        trend = 'declining';
      }
    }

    return {
      min: Math.round(min * 100) / 100,
      max: Math.round(max * 100) / 100,
      average: Math.round(average * 100) / 100,
      trend,
    };
  }

  /**
   * Detect coverage format from file
   */
  private detectFormat(file: Express.Multer.File): CoverageFormat {
    const filename = file.originalname.toLowerCase();
    const content = readFileSync(file.path, 'utf-8').slice(0, 2000); // Read first 2000 chars

    // Check for JaCoCo XML format (check before Cobertura as both are XML)
    if (content.includes('<report') && content.includes('<counter type=')) {
      return CoverageFormat.JACOCO;
    }

    // Check for Cobertura XML format
    if (content.includes('<coverage') || content.includes('<!DOCTYPE coverage')) {
      return CoverageFormat.COBERTURA;
    }

    // Check for LCOV format
    if (
      filename.endsWith('.lcov') ||
      filename.endsWith('.info') ||
      content.includes('SF:') ||
      content.includes('TN:')
    ) {
      return CoverageFormat.LCOV;
    }

    // Check for NYC JSON format
    if (filename.endsWith('.json') || content.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(readFileSync(file.path, 'utf-8'));
        // NYC JSON typically has file paths as keys with statement/branch/function coverage
        if (typeof parsed === 'object' && !Array.isArray(parsed)) {
          const firstKey = Object.keys(parsed)[0];
          if (firstKey && parsed[firstKey]?.statementMap) {
            return CoverageFormat.NYC_JSON;
          }
        }
      } catch {
        // Not valid JSON
      }
      return CoverageFormat.NYC_JSON;
    }

    // Unable to detect format - throw error with supported formats
    throw new BadRequestException(
      `Unable to detect coverage format for file "${file.originalname}". ` +
        `Supported formats: Cobertura XML, JaCoCo XML, NYC JSON, LCOV. ` +
        `Please ensure your file matches one of these formats.`,
    );
  }

  /**
   * Format coverage report response
   */
  private formatResponse(report: any): CoverageResponseDto {
    const response: CoverageResponseDto = {
      id: report.id,
      repositoryId: report.repositoryId,
      repository: report.repository,
      format: report.format,
      status: report.status,
      originalFilename: report.originalFilename,
      fileSize: report.fileSize,
      fileHash: report.fileHash,
      commitSha: report.commitSha,
      branch: report.branch,
      linesTotal: report.linesTotal,
      linesCovered: report.linesCovered,
      coveragePercentage: report.coveragePercentage,
      previousCoveragePercentage: report.previousCoveragePercentage,
      coverageDelta: report.coverageDelta,
      errorMessage: report.errorMessage,
      createdAt: report.createdAt,
      processedAt: report.processedAt,
    };

    if (report.modules) {
      response.modules = report.modules.map(
        (m: any): CoverageModuleDto => ({
          id: m.id,
          modulePath: m.modulePath,
          linesTotal: m.linesTotal,
          linesCovered: m.linesCovered,
          coveragePercentage: m.coveragePercentage,
        }),
      );
    }

    return response;
  }
}
