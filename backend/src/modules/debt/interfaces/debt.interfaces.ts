import { DebtMarker } from '@prisma/client';

/**
 * Paginated result interface for debt items
 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Debt filters interface
 */
export interface DebtFilters {
  page?: number;
  limit?: number;
  repositoryId?: string;
  authorId?: string;
  markerType?: DebtMarker;
  isResolved?: boolean;
  startDate?: string;
  endDate?: string;
  filePath?: string;
}

/**
 * Hot spot interface - files with high churn and bug correlation
 */
export interface HotSpot {
  filePath: string;
  repositoryId: string;
  repositoryName: string;
  churnRatio: number;
  bugCount: number;
  debtCount: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

/**
 * Debt trend data point
 */
export interface DebtTrendPoint {
  date: Date;
  totalDebt: number;
  addedDebt: number;
  resolvedDebt: number;
  netDebt: number;
}

/**
 * Debt trend response
 */
export interface DebtTrend {
  points: DebtTrendPoint[];
  velocity: number; // positive = accumulating, negative = reducing
  isAccumulating: boolean;
}

/**
 * Debt recommendation
 */
export interface DebtRecommendation {
  id: string;
  filePath: string;
  repositoryId: string;
  repositoryName: string;
  markerCount: number;
  complexity: number;
  impact: number;
  effort: number;
  priority: number;
  rationale: string;
}

/**
 * Developer debt attribution
 */
export interface DebtAttribution {
  developerId: string;
  developerName: string;
  developerEmail: string;
  avatarUrl?: string;
  debtIntroduced: number;
  debtResolved: number;
  netDebt: number;
}

/**
 * Module debt score
 */
export interface ModuleDebtScore {
  modulePath: string;
  repositoryId: string;
  score: number;
  todoCount: number;
  fixmeCount: number;
  hackCount: number;
  xxxCount: number;
  exceedsThreshold: boolean;
}

/**
 * Scanned debt marker from code
 */
export interface ScannedDebtMarker {
  markerType: DebtMarker;
  content: string;
  filePath: string;
  lineNumber: number;
}
