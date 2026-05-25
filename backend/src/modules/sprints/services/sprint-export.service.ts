import {
  Injectable,
  NotFoundException,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma';
import { SprintsService } from '../sprints.service';
import PDFDocument from 'pdfkit';
import { stringify } from 'csv-stringify/sync';

/**
 * Service for exporting sprint reports as PDF and CSV
 */
@Injectable()
export class SprintExportService {
  private readonly logger = new Logger(SprintExportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sprintsService: SprintsService,
  ) {}

  /**
   * Export sprint report as PDF
   *
   * @param sprintId - Sprint ID
   * @returns PDF buffer
   */
  async exportPdf(sprintId: string): Promise<Buffer> {
    this.logger.debug(`Exporting PDF for sprint ${sprintId}`);

    try {
      const sprint = await this.getSprintWithDetails(sprintId);
      const report = await this.sprintsService.generateReport(sprintId);
      const contributors = await this.getContributorBreakdown(sprintId);

      return this.generatePdfDocument(sprint, report, contributors);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to export PDF for sprint ${sprintId}`, error);
      throw new InternalServerErrorException('Failed to generate PDF export');
    }
  }

  /**
   * Export sprint report as CSV
   *
   * @param sprintId - Sprint ID
   * @returns CSV string
   */
  async exportCsv(sprintId: string): Promise<string> {
    this.logger.debug(`Exporting CSV for sprint ${sprintId}`);

    try {
      const sprint = await this.getSprintWithDetails(sprintId);
      const contributors = await this.getContributorBreakdown(sprintId);

      return this.generateCsvDocument(sprint, contributors);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to export CSV for sprint ${sprintId}`, error);
      throw new InternalServerErrorException('Failed to generate CSV export');
    }
  }

  /**
   * Get sprint with full details for export
   */
  private async getSprintWithDetails(sprintId: string) {
    const sprint = await this.prisma.sprint.findUnique({
      where: { id: sprintId },
      include: {
        team: {
          select: {
            id: true,
            name: true,
          },
        },
        organization: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!sprint) {
      throw new NotFoundException('Sprint not found');
    }

    return sprint;
  }

  /**
   * Get contributor breakdown for sprint
   */
  private async getContributorBreakdown(sprintId: string) {
    const sprint = await this.prisma.sprint.findUnique({
      where: { id: sprintId },
      include: {
        team: {
          include: {
            memberships: {
              where: { leftAt: null },
              include: {
                user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!sprint) {
      throw new NotFoundException('Sprint not found');
    }

    const memberIds = sprint.team.memberships.map((m) => m.user.id);

    // Get commits for each team member within the sprint date range
    const contributors = await Promise.all(
      sprint.team.memberships.map(async (membership) => {
        const commits = await this.prisma.commit.findMany({
          where: {
            developerId: membership.user.id,
            committedAt: {
              gte: sprint.startDate,
              lte: sprint.endDate,
            },
            repository: {
              organizationId: sprint.organizationId,
            },
          },
          select: {
            classification: true,
            linesAdded: true,
            linesDeleted: true,
          },
        });

        // Get reviews given by this developer during the sprint
        const reviews = await this.prisma.review.count({
          where: {
            reviewerId: membership.user.id,
            submittedAt: {
              gte: sprint.startDate,
              lte: sprint.endDate,
            },
          },
        });

        // Get latest DQS score
        const dqsScore = await this.prisma.dQSScore.findFirst({
          where: { developerId: membership.user.id },
          orderBy: { calculatedAt: 'desc' },
          select: { score: true },
        });

        // Calculate metrics
        const totalCommits = commits.length;
        const linesAdded = commits.reduce((sum, c) => sum + (c.linesAdded || 0), 0);
        const linesDeleted = commits.reduce((sum, c) => sum + (c.linesDeleted || 0), 0);
        const bugfixCommits = commits.filter((c) => c.classification === 'BUGFIX').length;
        const featureCommits = commits.filter((c) => c.classification === 'FEATURE').length;

        return {
          id: membership.user.id,
          name: membership.user.name,
          email: membership.user.email,
          totalCommits,
          linesAdded,
          linesDeleted,
          linesChanged: linesAdded + linesDeleted,
          bugfixCommits,
          featureCommits,
          reviewsGiven: reviews,
          dqsScore: dqsScore?.score ?? null,
        };
      }),
    );

    return contributors;
  }

  /**
   * Generate PDF document
   */
  private generatePdfDocument(sprint: any, report: any, contributors: any[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Title
      doc.fontSize(24).font('Helvetica-Bold').text('Sprint Report', { align: 'center' });
      doc.moveDown(0.5);

      // Sprint Info
      doc.fontSize(16).font('Helvetica-Bold').text(sprint.name);
      doc.fontSize(10).font('Helvetica').text(`Team: ${sprint.team.name}`);
      doc.text(`Organization: ${sprint.organization.name}`);
      doc.text(`Period: ${this.formatDate(sprint.startDate)} - ${this.formatDate(sprint.endDate)}`);
      doc.text(`Generated: ${this.formatDate(new Date())}`);
      doc.moveDown();

      // Summary Metrics Section
      doc.fontSize(14).font('Helvetica-Bold').text('Summary Metrics');
      doc.moveDown(0.5);

      this.addMetricRow(doc, 'Total Commits', report.totalCommits.toString());
      this.addMetricRow(doc, 'Average DQS', report.qualityMetrics.avgDQS.toFixed(1));
      this.addMetricRow(doc, 'Coverage', `${report.qualityMetrics.coveragePct.toFixed(1)}%`);
      doc.moveDown();

      // Commit Classification Breakdown
      doc.fontSize(14).font('Helvetica-Bold').text('Commit Classification');
      doc.moveDown(0.5);

      this.addMetricRow(doc, 'Features', report.classificationBreakdown.feature.toString());
      this.addMetricRow(doc, 'Bugfixes', report.classificationBreakdown.bugfix.toString());
      this.addMetricRow(doc, 'Refactors', report.classificationBreakdown.refactor.toString());
      this.addMetricRow(doc, 'Tests', report.classificationBreakdown.test.toString());
      this.addMetricRow(doc, 'Documentation', report.classificationBreakdown.docs.toString());
      doc.moveDown();

      // Bug Metrics
      doc.fontSize(14).font('Helvetica-Bold').text('Bug Metrics');
      doc.moveDown(0.5);

      this.addMetricRow(doc, 'Bugs Introduced', report.bugMetrics.bugsIntroduced.toString());
      this.addMetricRow(doc, 'Bugs Fixed', report.bugMetrics.bugsFixed.toString());
      this.addMetricRow(doc, 'Bug Debt', report.bugMetrics.bugDebt.toString());
      doc.moveDown();

      // Contributors Section
      doc.addPage();
      doc.fontSize(14).font('Helvetica-Bold').text('Contributor Breakdown');
      doc.moveDown(0.5);

      // Table header
      const tableTop = doc.y;
      const colWidths = [120, 60, 70, 70, 60, 60];
      const headers = ['Developer', 'Commits', 'Lines +/-', 'Features', 'Bugfixes', 'DQS'];

      doc.fontSize(9).font('Helvetica-Bold');
      let xPos = 50;
      headers.forEach((header, i) => {
        doc.text(header, xPos, tableTop, { width: colWidths[i], align: 'left' });
        xPos += colWidths[i];
      });

      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.3);

      // Table rows
      doc.font('Helvetica').fontSize(8);
      contributors.forEach((contributor) => {
        if (doc.y > 700) {
          doc.addPage();
        }

        xPos = 50;
        const rowY = doc.y;
        const rowData = [
          contributor.name.substring(0, 20),
          contributor.totalCommits.toString(),
          `+${contributor.linesAdded}/-${contributor.linesDeleted}`,
          contributor.featureCommits.toString(),
          contributor.bugfixCommits.toString(),
          contributor.dqsScore !== null ? contributor.dqsScore.toFixed(1) : 'N/A',
        ];

        rowData.forEach((data, i) => {
          doc.text(data, xPos, rowY, { width: colWidths[i], align: 'left' });
          xPos += colWidths[i];
        });

        doc.moveDown(0.8);
      });

      // Footer
      doc
        .fontSize(8)
        .font('Helvetica')
        .text(
          `SQDIS Sprint Report - Generated ${new Date().toISOString()}`,
          50,
          doc.page.height - 50,
          { align: 'center' },
        );

      doc.end();
    });
  }

  /**
   * Add a metric row to PDF
   */
  private addMetricRow(doc: PDFKit.PDFDocument, label: string, value: string) {
    doc.fontSize(10).font('Helvetica').text(`${label}: `, { continued: true });
    doc.font('Helvetica-Bold').text(value);
  }

  /**
   * Format date for display
   */
  private formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  /**
   * Generate CSV document
   */
  private generateCsvDocument(sprint: any, contributors: any[]): string {
    // CSV header row
    const headers = [
      'Developer Name',
      'Email',
      'Total Commits',
      'Lines Added',
      'Lines Deleted',
      'Lines Changed',
      'Feature Commits',
      'Bugfix Commits',
      'Reviews Given',
      'DQS Score',
    ];

    // CSV data rows
    const rows = contributors.map((contributor) => [
      contributor.name,
      contributor.email,
      contributor.totalCommits,
      contributor.linesAdded,
      contributor.linesDeleted,
      contributor.linesChanged,
      contributor.featureCommits,
      contributor.bugfixCommits,
      contributor.reviewsGiven,
      contributor.dqsScore !== null ? contributor.dqsScore.toFixed(1) : 'N/A',
    ]);

    // Add metadata rows at the top
    const metadata = [
      ['Sprint Report'],
      ['Sprint Name', sprint.name],
      ['Team', sprint.team.name],
      ['Organization', sprint.organization.name],
      ['Start Date', this.formatDate(sprint.startDate)],
      ['End Date', this.formatDate(sprint.endDate)],
      ['Generated', this.formatDate(new Date())],
      [], // Empty row separator
    ];

    // Combine metadata, headers, and data
    const allRows = [...metadata, headers, ...rows];

    return stringify(allRows);
  }

  /**
   * Generate filename with timestamp
   */
  generateFilename(sprintName: string, format: 'pdf' | 'csv'): string {
    const sanitizedName = sprintName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return `sprint_report_${sanitizedName}_${timestamp}.${format}`;
  }
}
