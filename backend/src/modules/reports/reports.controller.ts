/* eslint-disable*/
import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Res,
  StreamableFile,
  BadRequestException,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { ReportsService } from './reports.service';
import { LeaderboardService } from './services/leaderboard.service';
import {
  CreateReportDto,
  CreatePdfReportDto,
  CreateCsvReportDto,
  ReportFiltersDto,
  LeaderboardQueryDto,
} from './dto';
import { FileStorageService } from './services/file-storage.service';
import { ReportType, ReportStatus } from './constants';
import { createReadStream } from 'fs';

/**
 * Controller for report generation and management
 */
@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly fileStorageService: FileStorageService,
    private readonly leaderboardService: LeaderboardService,
  ) {}

  /**
   * Create a new report (PDF or CSV)
   */
  @Post()
  async createReport(@Body() dto: CreateReportDto, @GetUser() user: any) {
    return this.reportsService.createReport(dto, user.organizationId, user.id);
  }

  /**
   * Create a PDF report
   *
   * This endpoint generates a PDF report asynchronously and returns
   * a report object with a download URL once generation is complete.
   */
  @Post('pdf')
  async createPdfReport(@Body() dto: CreatePdfReportDto, @GetUser() user: any) {
    // Convert to CreateReportDto with PDF type
    const reportDto: CreateReportDto = {
      ...dto,
      type: ReportType.PDF,
    };

    return this.reportsService.createReport(reportDto, user.organizationId, user.id);
  }

  /**
   * Create a CSV report
   *
   * This endpoint generates a CSV report asynchronously and returns
   * a report object with a download URL once generation is complete.
   * The CSV includes all metrics per developer: commits, features,
   * bugfixes, lines added/deleted, reviews, and DQS scores.
   */
  @Post('csv')
  async createCsvReport(@Body() dto: CreateCsvReportDto, @GetUser() user: any) {
    // Convert to CreateReportDto with CSV type
    const reportDto: CreateReportDto = {
      ...dto,
      type: ReportType.CSV,
    };

    return this.reportsService.createReport(reportDto, user.organizationId, user.id);
  }

  /**
   * Get all reports with filters
   * Supports report type, date range, and repository filters
   */
  @Get()
  async findAll(@Query() filters: ReportFiltersDto, @GetUser() user: any) {
    return this.reportsService.findAll(user.organizationId, filters);
  }

  /**
   * Get report by ID
   */
  @Get(':id')
  async findById(@Param('id') id: string, @GetUser() user: any) {
    return this.reportsService.findById(id, user.organizationId);
  }

  /**
   * Download report file
   * Handles generation failures with error messages
   */
  @Get(':id/download')
  async downloadReport(
    @Param('id') id: string,
    @GetUser() user: any,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const report = await this.reportsService.findById(id, user.organizationId);

    // Handle generation failures with descriptive error messages
    if (report.status === ReportStatus.FAILED) {
      throw new BadRequestException(
        report.errorMessage || 'Report generation failed. Please try again.',
      );
    }

    if (report.status === ReportStatus.PENDING || report.status === ReportStatus.PROCESSING) {
      throw new BadRequestException('Report is still being generated. Please wait and try again.');
    }

    const filePath = await this.reportsService.getDownloadUrl(id, user.organizationId);

    // Set appropriate headers
    const contentType = report.type === ReportType.PDF ? 'application/pdf' : 'text/csv';

    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${report.filename}"`,
    });

    const file = createReadStream(filePath);
    return new StreamableFile(file);
  }

  /**
   * Retry a failed report generation
   */
  @Post(':id/retry')
  async retryReport(@Param('id') id: string, @GetUser() user: any) {
    return this.reportsService.retryFailedReport(id, user.organizationId);
  }

  /**
   * Delete a report
   */
  @Delete(':id')
  async deleteReport(@Param('id') id: string, @GetUser() user: any) {
    await this.reportsService.delete(id, user.organizationId);
    return { message: 'Report deleted successfully' };
  }
}

/**
 * Controller for developer leaderboard
 */
@Controller('leaderboard')
@UseGuards(JwtAuthGuard)
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  /**
   * Get developer leaderboard
   * Ranks developers by DQS descending by default
   * Includes commit_count, bug_fix_count, churn, coverage, reviews, PR merge rate, streak
   * Supports sorting, filtering, and time periods
   * Cached with 5min TTL
   */
  @Get()
  async getLeaderboard(@Query() query: LeaderboardQueryDto, @GetUser() user: any) {
    return this.leaderboardService.getLeaderboard(user.organizationId, query);
  }

  /**
   * Get team leaderboard
   * Ranks teams by average DQS descending by default
   * Includes member count, total commits, sprint velocity, review turnaround, goal completion
   * Supports sorting, filtering, and time periods
   * Cached with 5min TTL
   */
  @Get('teams')
  async getTeamLeaderboard(@Query() query: LeaderboardQueryDto, @GetUser() user: any) {
    return this.leaderboardService.getTeamLeaderboard(user.organizationId, query);
  }
}
