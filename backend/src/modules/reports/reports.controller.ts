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
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';

/**
 * Controller for report generation and management
 */
@ApiTags('Reports')
@ApiBearerAuth()
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
  @ApiOperation({ summary: 'Create a new report (PDF or CSV)' })
  @ApiResponse({ status: 201, description: 'Report generation request received.' })
  async createReport(@Body() dto: CreateReportDto, @GetUser() user: any) {
    return this.reportsService.createReport(dto, user.organizationId, user.id);
  }

  /**
   * Create a PDF report
   */
  @Post('pdf')
  @ApiOperation({ summary: 'Create a PDF report asynchronously' })
  @ApiResponse({ status: 201, description: 'PDF report generation request received.' })
  async createPdfReport(@Body() dto: CreatePdfReportDto, @GetUser() user: any) {
    const reportDto: CreateReportDto = {
      ...dto,
      type: ReportType.PDF,
    };

    return this.reportsService.createReport(reportDto, user.organizationId, user.id);
  }

  /**
   * Create a CSV report
   */
  @Post('csv')
  @ApiOperation({ summary: 'Create a CSV report asynchronously' })
  @ApiResponse({ status: 201, description: 'CSV report generation request received.' })
  async createCsvReport(@Body() dto: CreateCsvReportDto, @GetUser() user: any) {
    const reportDto: CreateReportDto = {
      ...dto,
      type: ReportType.CSV,
    };

    return this.reportsService.createReport(reportDto, user.organizationId, user.id);
  }

  /**
   * Get all reports with filters
   */
  @Get()
  @ApiOperation({ summary: 'Get all reports with filters' })
  @ApiResponse({ status: 200, description: 'Reports list retrieved successfully.' })
  async findAll(@Query() filters: ReportFiltersDto, @GetUser() user: any) {
    return this.reportsService.findAll(user.organizationId, filters);
  }

  /**
   * Get report by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get report details by ID' })
  @ApiParam({ name: 'id', description: 'Report ID' })
  @ApiResponse({ status: 200, description: 'Report details retrieved.' })
  async findById(@Param('id') id: string, @GetUser() user: any) {
    return this.reportsService.findById(id, user.organizationId);
  }

  /**
   * Download report file
   */
  @Get(':id/download')
  @ApiOperation({ summary: 'Download generated report file by ID' })
  @ApiParam({ name: 'id', description: 'Report ID' })
  @ApiResponse({ status: 200, description: 'File stream returned.' })
  async downloadReport(
    @Param('id') id: string,
    @GetUser() user: any,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const report = await this.reportsService.findById(id, user.organizationId);

    if (report.status === ReportStatus.FAILED) {
      throw new BadRequestException(
        report.errorMessage || 'Report generation failed. Please try again.',
      );
    }

    if (report.status === ReportStatus.PENDING || report.status === ReportStatus.PROCESSING) {
      throw new BadRequestException('Report is still being generated. Please wait and try again.');
    }

    const filePath = await this.reportsService.getDownloadUrl(id, user.organizationId);

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
  @ApiOperation({ summary: 'Retry generating a failed report' })
  @ApiParam({ name: 'id', description: 'Report ID' })
  @ApiResponse({ status: 201, description: 'Retrying report generation.' })
  async retryReport(@Param('id') id: string, @GetUser() user: any) {
    return this.reportsService.retryFailedReport(id, user.organizationId);
  }

  /**
   * Delete a report
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a report' })
  @ApiParam({ name: 'id', description: 'Report ID' })
  @ApiResponse({ status: 200, description: 'Report deleted successfully.' })
  async deleteReport(@Param('id') id: string, @GetUser() user: any) {
    await this.reportsService.delete(id, user.organizationId);
    return { message: 'Report deleted successfully' };
  }
}

/**
 * Controller for developer leaderboard
 */
@ApiTags('Leaderboard')
@ApiBearerAuth()
@Controller('leaderboard')
@UseGuards(JwtAuthGuard)
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  /**
   * Get developer leaderboard
   */
  @Get()
  @ApiOperation({ summary: 'Get developer leaderboard ranked by DQS' })
  @ApiResponse({ status: 200, description: 'Developer leaderboard retrieved.' })
  async getLeaderboard(@Query() query: LeaderboardQueryDto, @GetUser() user: any) {
    return this.leaderboardService.getLeaderboard(user.organizationId, query);
  }

  /**
   * Get team leaderboard
   */
  @Get('teams')
  @ApiOperation({ summary: 'Get team leaderboard ranked by average DQS' })
  @ApiResponse({ status: 200, description: 'Team leaderboard retrieved.' })
  async getTeamLeaderboard(@Query() query: LeaderboardQueryDto, @GetUser() user: any) {
    return this.leaderboardService.getTeamLeaderboard(user.organizationId, query);
  }
}
