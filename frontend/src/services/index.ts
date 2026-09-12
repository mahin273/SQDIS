// ============================================================
// SQDIS Frontend - Centralized Service Index
// ============================================================

// API client exports
export {
  api,
  tokenManager,
  setTokens,
  setCurrentOrganizationId,
  getAccessToken,
  getRefreshToken,
  clearTokens,
} from './api';
export type { ApiError, ApiResponse } from '@/types';

// Domain services
export { authService } from './auth.service';
export { organizationService } from './organization.service';
export { dashboardService } from './dashboard.service';
export { teamsService } from './teams.service';
export { projectsService } from './projects.service';
export { sprintsService } from './sprints.service';
export { releasesService } from './releases.service';
export { reviewsService } from './reviews.service';
export { goalsService } from './goals.service';
export { commitsService } from './commits.service';
export { coverageService } from './coverage.service';
export { debtService } from './debt.service';
export { alertsService } from './alerts.service';
export { notificationsService } from './notifications.service';
export { reportsService, leaderboardService } from './reports.service';
export { auditService } from './audit.service';
export { emailAliasesService } from './email-aliases.service';
export { onboardingService } from './onboarding.service';
export { developersService } from './developers.service';
export { repositoriesService } from './repositories.service';
export { membersService } from './members.service';
export { githubService } from './github.service';
export { scoresService } from './scores.service';
export { codeIntelligenceService } from './codeIntelligence.service';
export { qualityGateService } from './qualityGate.service';
export type { QualityGateResult, QualityGateStatus, EvaluateQualityGatePayload } from './qualityGate.service';
export type { RepositoryHotspot, CommitRiskItem, TeamBusFactorResponse, ModuleBusFactorResult, TestImpactResponse, TestImpactResult, AstDefectResponse, CommitRiskResponse } from './codeIntelligence.service';

// Backward-compatible exports for existing code using old naming
export { authService as authApi } from './auth.service';
export { auditService as auditLogsApi } from './audit.service';
export { organizationService as organizationsApi } from './organization.service';

// Re-export all domain types
export * from '@/types';
