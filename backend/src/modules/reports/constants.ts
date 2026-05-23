import { ReportType, ReportStatus, ReportScope } from '@prisma/client';
export { ReportType, ReportStatus, ReportScope };

/**
 * Queue name for report generation jobs
 */
export const REPORT_QUEUE = 'report-generation';

/**
 * Default export directory for reports
 */
export const REPORTS_EXPORT_DIR = 'exports/reports';

/**
 * Maximum file size for exports (100MB)
 */
export const MAX_EXPORT_SIZE = 100 * 1024 * 1024;

/**
 * Report retention period in days
 */
export const REPORT_RETENTION_DAYS = 30;
