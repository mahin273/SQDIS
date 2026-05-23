import { Injectable, Logger } from '@nestjs/common';
import PDFDocument from 'pdfkit';

/**
 * Report data interface for PDF generation
 */
export interface PdfReportData {
  title: string;
  organizationName: string;
  dateRange: { start: Date; end: Date };
  generatedAt: Date;
  teamName?: string;
  projectName?: string;
  developers: DeveloperMetrics[];
  summary: ReportSummary;
}

export interface DeveloperMetrics {
  id: string;
  name: string;
  email: string;
  totalCommits: number;
  bugfixCommits: number;
  featureCommits: number;
  refactorCommits?: number;
  testCommits?: number;
  docsCommits?: number;
  linesAdded: number;
  linesDeleted: number;
  reviewsGiven?: number;
  dqsScore: number | null;
}

export interface ReportSummary {
  totalCommits: number;
  totalDevelopers: number;
  avgDQS: number;
  totalBugfixes: number;
  totalFeatures: number;
}

/**
 * Service for generating PDF reports with scores, charts, and contributor
 */
@Injectable()
export class PdfGeneratorService {
  private readonly logger = new Logger(PdfGeneratorService.name);

  // Color palette for the report
  private readonly colors = {
    primary: '#2563eb', // Blue
    secondary: '#64748b', // Slate
    success: '#22c55e', // Green
    warning: '#f59e0b', // Amber
    danger: '#ef4444', // Red
    background: '#f8fafc', // Light gray
    text: '#1e293b', // Dark slate
    textLight: '#64748b', // Light slate
    border: '#e2e8f0', // Border gray
  };

  /**
   * Generate PDF report with scores, charts, and contributors
   */
  async generatePdf(data: PdfReportData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: data.title,
          Author: 'SQDIS - Software Quality & Developer Intelligence System',
          Subject: 'Quality Report',
          Creator: 'SQDIS Report Generator',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      try {
        // Generate report sections
        this.addHeader(doc, data);
        this.addSummarySection(doc, data);
        this.addScoreChart(doc, data);
        this.addContributorsSection(doc, data);
        this.addFooter(doc);

        doc.end();
      } catch (error) {
        this.logger.error('Error generating PDF', error);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  /**
   * Add report header with title and metadata
   */
  private addHeader(doc: PDFKit.PDFDocument, data: PdfReportData): void {
    // Title bar background
    doc.rect(0, 0, doc.page.width, 100).fill(this.colors.primary);

    // Title
    doc
      .fillColor('#ffffff')
      .fontSize(24)
      .font('Helvetica-Bold')
      .text(data.title, 50, 35, { align: 'left' });

    // Subtitle with organization
    doc.fontSize(12).font('Helvetica').text(`Organization: ${data.organizationName}`, 50, 65);

    // Reset position
    doc.fillColor(this.colors.text);
    doc.y = 120;

    // Metadata section
    doc.fontSize(10).font('Helvetica');

    const metadataY = doc.y;
    doc.text('Report Period:', 50, metadataY);
    doc.text(
      `${this.formatDate(data.dateRange.start)} - ${this.formatDate(data.dateRange.end)}`,
      150,
      metadataY,
    );

    doc.text('Generated:', 350, metadataY);
    doc.text(this.formatDateTime(data.generatedAt), 420, metadataY);

    if (data.teamName) {
      doc.text('Team:', 50, metadataY + 15);
      doc.text(data.teamName, 150, metadataY + 15);
    }

    if (data.projectName) {
      doc.text('Project:', 50, metadataY + (data.teamName ? 30 : 15));
      doc.text(data.projectName, 150, metadataY + (data.teamName ? 30 : 15));
    }

    doc.moveDown(2);
  }

  /**
   * Add summary section with key metrics
   */
  private addSummarySection(doc: PDFKit.PDFDocument, data: PdfReportData): void {
    const startY = doc.y;

    // Section title
    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .fillColor(this.colors.primary)
      .text('Summary', 50, startY);

    doc.moveDown(0.5);

    // Summary cards
    const cardWidth = 100;
    const cardHeight = 60;
    const cardSpacing = 15;
    const cardsStartX = 50;
    const cardsY = doc.y;

    const summaryCards = [
      {
        label: 'Developers',
        value: data.summary.totalDevelopers.toString(),
        color: this.colors.primary,
      },
      {
        label: 'Total Commits',
        value: data.summary.totalCommits.toString(),
        color: this.colors.secondary,
      },
      {
        label: 'Avg DQS',
        value: data.summary.avgDQS.toFixed(1),
        color: this.getDqsColor(data.summary.avgDQS),
      },
      {
        label: 'Features',
        value: data.summary.totalFeatures.toString(),
        color: this.colors.success,
      },
      {
        label: 'Bugfixes',
        value: data.summary.totalBugfixes.toString(),
        color: this.colors.warning,
      },
    ];

    summaryCards.forEach((card, index) => {
      const x = cardsStartX + (cardWidth + cardSpacing) * index;

      // Card background
      doc
        .roundedRect(x, cardsY, cardWidth, cardHeight, 5)
        .fillAndStroke(this.colors.background, this.colors.border);

      // Value
      doc
        .fillColor(card.color)
        .fontSize(20)
        .font('Helvetica-Bold')
        .text(card.value, x, cardsY + 12, { width: cardWidth, align: 'center' });

      // Label
      doc
        .fillColor(this.colors.textLight)
        .fontSize(9)
        .font('Helvetica')
        .text(card.label, x, cardsY + 40, { width: cardWidth, align: 'center' });
    });

    doc.y = cardsY + cardHeight + 20;
    doc.fillColor(this.colors.text);
  }

  /**
   * Add visual score chart (bar chart representation)
   */
  private addScoreChart(doc: PDFKit.PDFDocument, data: PdfReportData): void {
    if (data.developers.length === 0) return;

    const startY = doc.y;

    // Section title
    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .fillColor(this.colors.primary)
      .text('DQS Score Distribution', 50, startY);

    doc.moveDown(0.5);

    // Get top 10 developers by DQS
    const topDevelopers = [...data.developers]
      .filter((d) => d.dqsScore !== null)
      .sort((a, b) => (b.dqsScore || 0) - (a.dqsScore || 0))
      .slice(0, 10);

    if (topDevelopers.length === 0) {
      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor(this.colors.textLight)
        .text('No DQS scores available', 50);
      doc.moveDown();
      return;
    }

    const chartStartY = doc.y;
    const barHeight = 18;
    const barSpacing = 5;
    const maxBarWidth = 300;
    const labelWidth = 120;
    const scoreWidth = 50;

    topDevelopers.forEach((dev, index) => {
      const y = chartStartY + (barHeight + barSpacing) * index;
      const score = dev.dqsScore || 0;
      const barWidth = (score / 100) * maxBarWidth;

      // Developer name
      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor(this.colors.text)
        .text(dev.name.substring(0, 20), 50, y + 4, { width: labelWidth });

      // Bar background
      doc.rect(50 + labelWidth, y, maxBarWidth, barHeight).fill(this.colors.background);

      // Bar fill
      doc.rect(50 + labelWidth, y, barWidth, barHeight).fill(this.getDqsColor(score));

      // Score value
      doc
        .fillColor(this.colors.text)
        .text(score.toFixed(1), 50 + labelWidth + maxBarWidth + 10, y + 4, { width: scoreWidth });
    });

    doc.y = chartStartY + (barHeight + barSpacing) * topDevelopers.length + 20;
  }

  /**
   * Add contributors table section
   */
  private addContributorsSection(doc: PDFKit.PDFDocument, data: PdfReportData): void {
    if (data.developers.length === 0) return;

    // Check if we need a new page
    if (doc.y > 600) {
      doc.addPage();
    }

    const startY = doc.y;

    // Section title
    doc
      .fontSize(16)
      .font('Helvetica-Bold')
      .fillColor(this.colors.primary)
      .text('Contributors', 50, startY);

    doc.moveDown(0.5);

    // Table configuration
    const columns = [
      { header: 'Developer', width: 120 },
      { header: 'Commits', width: 55 },
      { header: 'Features', width: 55 },
      { header: 'Bugfixes', width: 55 },
      { header: 'Lines +/-', width: 80 },
      { header: 'Reviews', width: 50 },
      { header: 'DQS', width: 45 },
    ];

    const tableStartX = 50;
    const rowHeight = 20;
    let currentY = doc.y;

    // Table header
    doc
      .rect(
        tableStartX,
        currentY,
        columns.reduce((sum, c) => sum + c.width, 0),
        rowHeight,
      )
      .fill(this.colors.primary);

    let xPos = tableStartX;
    doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold');

    columns.forEach((col) => {
      doc.text(col.header, xPos + 5, currentY + 5, { width: col.width - 10, align: 'left' });
      xPos += col.width;
    });

    currentY += rowHeight;

    // Table rows
    doc.font('Helvetica').fontSize(8);
    const sortedDevelopers = [...data.developers].sort((a, b) => b.totalCommits - a.totalCommits);

    sortedDevelopers.forEach((dev, index) => {
      // Check for page break
      if (currentY > 750) {
        doc.addPage();
        currentY = 50;

        // Repeat header on new page
        doc
          .rect(
            tableStartX,
            currentY,
            columns.reduce((sum, c) => sum + c.width, 0),
            rowHeight,
          )
          .fill(this.colors.primary);

        xPos = tableStartX;
        doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold');

        columns.forEach((col) => {
          doc.text(col.header, xPos + 5, currentY + 5, { width: col.width - 10, align: 'left' });
          xPos += col.width;
        });

        currentY += rowHeight;
        doc.font('Helvetica').fontSize(8);
      }

      // Alternate row background
      if (index % 2 === 0) {
        doc
          .rect(
            tableStartX,
            currentY,
            columns.reduce((sum, c) => sum + c.width, 0),
            rowHeight,
          )
          .fill(this.colors.background);
      }

      // Row data
      xPos = tableStartX;
      doc.fillColor(this.colors.text);

      const rowData = [
        dev.name.substring(0, 18),
        dev.totalCommits.toString(),
        dev.featureCommits.toString(),
        dev.bugfixCommits.toString(),
        `+${this.formatNumber(dev.linesAdded)}/-${this.formatNumber(dev.linesDeleted)}`,
        (dev.reviewsGiven || 0).toString(),
        dev.dqsScore !== null ? dev.dqsScore.toFixed(1) : 'N/A',
      ];

      rowData.forEach((cell, colIndex) => {
        // Color DQS score based on value
        if (colIndex === 6 && dev.dqsScore !== null) {
          doc.fillColor(this.getDqsColor(dev.dqsScore));
        } else {
          doc.fillColor(this.colors.text);
        }
        doc.text(cell, xPos + 5, currentY + 5, {
          width: columns[colIndex].width - 10,
          align: 'left',
        });
        xPos += columns[colIndex].width;
      });

      currentY += rowHeight;
    });

    // Table border
    doc
      .rect(
        tableStartX,
        doc.y - (sortedDevelopers.length + 1) * rowHeight,
        columns.reduce((sum, c) => sum + c.width, 0),
        (sortedDevelopers.length + 1) * rowHeight,
      )
      .stroke(this.colors.border);

    doc.y = currentY + 10;
  }

  /**
   * Add footer to all pages
   */
  private addFooter(doc: PDFKit.PDFDocument): void {
    const pages = doc.bufferedPageRange();
    for (let i = 0; i < pages.count; i++) {
      doc.switchToPage(i);

      // Footer line
      doc
        .moveTo(50, doc.page.height - 50)
        .lineTo(doc.page.width - 50, doc.page.height - 50)
        .stroke(this.colors.border);

      // Footer text
      doc
        .fontSize(8)
        .font('Helvetica')
        .fillColor(this.colors.textLight)
        .text(
          `SQDIS Report - Generated ${new Date().toISOString().slice(0, 10)}`,
          50,
          doc.page.height - 40,
          { align: 'left' },
        )
        .text(`Page ${i + 1} of ${pages.count}`, 50, doc.page.height - 40, {
          align: 'right',
          width: doc.page.width - 100,
        });
    }
  }

  /**
   * Get color based on DQS score
   */
  private getDqsColor(score: number): string {
    if (score >= 80) return this.colors.success;
    if (score >= 60) return this.colors.primary;
    if (score >= 40) return this.colors.warning;
    return this.colors.danger;
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
   * Format date and time for display
   */
  private formatDateTime(date: Date): string {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  /**
   * Format large numbers with K/M suffix
   */
  private formatNumber(num: number): string {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }
}
