// ============================================================
// SQDIS Frontend - Complete Domain Types
// ============================================================

// ============== COMMON ==============

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ApiError {
  message: string;
  statusCode: number;
  error?: string;
  details?: Record<string, unknown>;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

// ============== AUTH & USER ==============

export type UserRole = 'OWNER' | 'ADMIN' | 'TEAM_LEAD' | 'DEVELOPER' | 'VIEWER';

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  organizationId?: string;
  role?: UserRole;
  memberships?: Array<{
    organizationId: string;
    organizationName: string;
    organizationSlug: string;
    role: UserRole;
    joinedAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
  firstName?: string;
  lastName?: string;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface ForgotPasswordRequest {
  identifier: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface SwitchOrganizationRequest {
  organizationId: string;
}

export interface OAuthCallbackParams {
  accessToken: string;
  refreshToken: string;
  user: string;
}

export interface UpdateProfileRequest {
  name?: string;
  avatarUrl?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

// ============== ORGANIZATION ==============

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  createdAt: string;
  updatedAt: string;
  memberCount?: number;
  role?: UserRole;
}

export interface CreateOrganizationRequest {
  name: string;
  slug: string;
  logoUrl?: string;
}

export interface UpdateOrganizationRequest {
  name?: string;
  slug?: string;
  logoUrl?: string;
}

export interface OrganizationMember {
  id: string;
  userId: string;
  organizationId: string;
  role: UserRole;
  user: User;
  joinedAt: string;
}

export interface UpdateMemberRequest {
  role: UserRole;
}

export interface InviteMemberRequest {
  email: string;
}

export interface Invitation {
  id: string;
  email: string;
  organizationId: string;
  organization?: { id: string; name: string; slug: string };
  token: string;
  role: UserRole;
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
  expiresAt: string;
  createdAt: string;
}

export interface AcceptInvitationRequest {
  token: string;
}

// ============== DASHBOARD ==============

export interface DashboardStats {
  totalDevelopers: number;
  totalTeams: number;
  totalRepositories: number;
  totalProjects?: number;
  totalCommits: number;
  bugFixCommits?: number;
  avgSqs?: number;
  avgSQS?: number;
  avgDqs?: number;
  activeAlerts?: number;
  riskyModulesCount?: number;
  coverage?: number;
  avgCoverage?: number;
  techDebt?: number;
}

export interface TrendDataPoint {
  date: string;
  value: number;
}

export interface SqsTrendPoint {
  date: string;
  avgSqs?: number;
  value?: number;
}

export interface CommitTrendPoint {
  date: string;
  count?: number;
  value?: number;
}

export interface TopRepository {
  id: string;
  name: string;
  fullName?: string;
  sqs: number;
  coverage?: number;
  commitCount: number;
  lastActivity?: string;
}

export interface TopDeveloper {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  dqs: number;
  commitCount?: number;
  teamName?: string;
  trend?: number;
}

export interface TopTeam {
  id: string;
  name: string;
  avgDqs: number;
  memberCount: number;
}

export interface RecentActivity {
  id: string;
  type: string;
  title?: string;
  description: string;
  repositoryName?: string;
  author?: string;
  user?: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  timestamp: string;
}

export interface DashboardAlert {
  id: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  repositoryName?: string;
  timestamp: string;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
}

// ============== TEAMS ==============

export interface Team {
  id: string;
  name: string;
  description?: string;
  leadId?: string;
  lead?: User;
  members?: User[];
  projects?: Project[];
  score?: number;
  organizationId: string;
  projectId?: string;
  project?: Project;
  memberCount?: number;
  projectCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  user: User;
  role: 'LEAD' | 'MEMBER';
  joinedAt: string;
}

export interface CreateTeamRequest {
  name: string;
  description?: string;
  leadId?: string;
  memberIds?: string[];
}

export interface UpdateTeamRequest {
  name?: string;
  description?: string;
  leadId?: string;
}

export interface AddTeamMemberRequest {
  userId: string;
}

export interface AssignLeadRequest {
  userId: string;
}

export interface TeamMetrics {
  teamId: string;
  teamName: string;
  memberCount: number;
  avgDqs: number;
  avgSqs: number;
  totalCommits: number;
  reviewsCompleted: number;
  avgReviewTurnaround: number;
  coverage: number;
  techDebt: number;
}

export interface TeamLeaderboardEntry {
  teamId: string;
  name: string;
  avgDqs: number;
  memberCount: number;
  rank: number;
}

export interface TeamLeaderboardResponse {
  data: TeamLeaderboardEntry[];
  total: number;
}

// ============== PROJECTS ==============

export interface Project {
  id: string;
  name: string;
  description?: string;
  key: string;
  color?: string;
  organizationId: string;
  repositories?: Repository[];
  teams?: Team[];
  sprints?: Sprint[];
  sqs?: number;
  sqsScore?: number;
  repositoryCount?: number;
  teamCount?: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface CreateProjectRequest {
  name: string;
  description?: string;
  key: string;
  color?: string;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  key?: string;
  color?: string;
}

export interface AssignRepositoryRequest {
  repositoryId: string;
}

export interface AssignTeamRequest {
  teamId: string;
}

export interface ProjectMetrics {
  projectId: string;
  projectName: string;
  totalCommits: number;
  totalSprints: number;
  activeSprints: number;
  avgSqs: number;
  avgVelocity: number;
  totalDebt: number;
  recentActivity: RecentActivity[];
  commitBreakdown: Record<string, number>;
}

export interface ProjectDebtItem {
  id: string;
  projectId: string;
  repositoryId: string;
  type: string;
  title: string;
  description?: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  createdAt: string;
}

// ============== SPRINTS ==============

export type SprintStatus = 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export interface Sprint {
  id: string;
  name: string;
  goal?: string;
  status: SprintStatus;
  teamId: string;
  team?: Team;
  projectId?: string;
  project?: Project;
  startDate: string;
  endDate: string;
  committedPoints?: number;
  completedPoints?: number;
  velocity?: number;
  commits?: Commit[];
  report?: SprintReport;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSprintRequest {
  name: string;
  goal?: string;
  teamId: string;
  startDate: string;
  endDate: string;
}

export interface UpdateSprintRequest {
  name?: string;
  goal?: string;
  status?: SprintStatus;
  startDate?: string;
  endDate?: string;
}

export interface SprintReport {
  id: string;
  sprintId: string;
  committedPoints: number;
  completedPoints: number;
  velocity: number;
  avgDqs: number;
  avgCodeQuality: number;
  avgReviewSpeed: number;
  bugFixRate: number;
  totalCommits: number;
  commitsByType: Record<string, number>;
}

export interface SprintCompareResponse {
  sprints: Array<{
    id: string;
    name: string;
    status: SprintStatus;
    committedPoints: number;
    completedPoints: number;
    velocity: number;
    avgDqs: number;
    avgCodeQuality: number;
  }>;
  changes: Record<string, number>;
}

export interface VelocityTrend {
  data: Array<{
    sprintId: string;
    sprintName: string;
    endDate: string;
    velocity: number;
  }>;
}

export interface SprintTimelineEntry {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: SprintStatus;
  teamName: string;
}

export interface SprintBurndownPoint {
  date: string;
  idealRemaining?: number;
  actualRemaining?: number;
  ideal?: number;
  remaining?: number;
  completed?: number;
}

export interface SprintBurndown {
  sprintId: string;
  sprintName?: string;
  startDate?: string;
  endDate?: string;
  totalWork?: number;
  completedWork?: number;
  remainingWork?: number;
  burndownData?: SprintBurndownPoint[];
  data?: SprintBurndownPoint[];
  projectedCompletion?: string | null;
  isOnTrack?: boolean;
}

export interface SprintHealth {
  sprintId: string;
  sprintName: string;
  score: number;
  indicators: Array<{
    key: string;
    label: string;
    score: number;
    status: 'good' | 'warning' | 'critical';
  }>;
}

export interface SprintContributions {
  sprintId: string;
  data: Array<{
    userId: string;
    name: string;
    commits: number;
    insertions: number;
    deletions: number;
    dqs: number;
  }>;
}

export interface SprintGoal {
  id: string;
  sprintId: string;
  title: string;
  description?: string;
  progress: number;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'AT_RISK';
  createdAt: string;
}

export interface CreateSprintGoalRequest {
  title: string;
  description?: string;
}

export interface SprintRetrospective {
  id: string;
  sprintId: string;
  whatWentWell: string;
  whatCouldImprove: string;
  actionItems: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateRetrospectiveRequest {
  whatWentWell: string;
  whatCouldImprove: string;
  actionItems: string[];
}

export interface SprintCarryOver {
  id: string;
  sourceSprintId: string;
  targetSprintId?: string;
  title: string;
  description?: string;
  status: 'PENDING' | 'MOVED' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
}

export interface CreateCarryOverRequest {
  title: string;
  description?: string;
  targetSprintId?: string;
}

// ============== RELEASES ==============

export type ReleaseStatus = 'DRAFT' | 'PLANNED' | 'IN_PROGRESS' | 'READY' | 'RELEASED' | 'ROLLED_BACK';

export interface Release {
  id: string;
  version: string;
  description?: string;
  status: ReleaseStatus;
  organizationId: string;
  targetDate?: string;
  shippedAt?: string;
  isActive?: boolean;
  readiness?: ReleaseReadiness;
  createdAt: string;
  updatedAt: string;
  sprints?: Sprint[];
  name?: string;
}

export interface CreateReleaseRequest {
  version: string;
  targetDate: string;
  description?: string;
}

export interface UpdateReleaseRequest {
  version?: string;
  description?: string;
  status?: ReleaseStatus;
  targetDate?: string;
}

export interface AssociateSprintRequest {
  sprintId: string;
}

export interface ReleaseReadiness {
  releaseId: string;
  version: string;
  score: number;
  status: 'NOT_READY' | 'CONCERNING' | 'READY';
  breakdown: Array<{
    category: string;
    score: number;
    weight: number;
    status: 'pass' | 'warn' | 'fail';
  }>;
  risks: Array<{
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    message: string;
  }>;
}

// ============== COMMITS ==============

export type CommitClassification =
  | 'FEATURE'
  | 'BUGFIX'
  | 'CHORE'
  | 'REFACTOR'
  | 'DOCS'
  | 'TEST'
  | 'STYLE'
  | 'PERF'
  | 'CI'
  | 'BUILD'
  | 'REVERT'
  | 'UNKNOWN';

export interface Commit {
  id: string;
  sha: string;
  message: string;
  authorEmail: string;
  authorName: string;
  authorId?: string;
  repositoryId: string;
  repository?: Repository;
  branch: string;
  committedAt: string;
  insertions: number;
  deletions: number;
  filesChanged: number;
  classification: CommitClassification;
  sqs?: number;
  organizationId: string;
}

export interface CommitFilters {
  page?: number;
  pageSize?: number;
  limit?: number;
  organizationId?: string;
  repositoryId?: string;
  authorId?: string;
  branch?: string;
  startDate?: string;
  endDate?: string;
  classification?: CommitClassification;
  search?: string;
}

export interface CommitStats {
  totalCommits: number;
  totalInsertions: number;
  totalDeletions: number;
  avgFilesChanged: number;
  commitsByType: Record<string, number>;
  topAuthors: Array<{
    authorId: string;
    name: string;
    count: number;
  }>;
}

export interface HeatmapData {
  repositoryId: string;
  repositoryName: string;
  data: Array<{
    filePath: string;
    totalChurn: number;
    insertions: number;
    deletions: number;
    commitCount: number;
    lastModified: string;
    score: number;
  }>;
}

// ============== COVERAGE ==============

export type CoverageFormat = 'LCOV' | 'COBERTURA' | 'NYC_JSON' | 'JACOCO';
export type CoverageStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface CoverageReport {
  id: string;
  repositoryId: string;
  repository?: Repository;
  format: CoverageFormat;
  status: CoverageStatus;
  originalFilename: string;
  fileSize: number;
  fileHash: string;
  commitSha?: string;
  branch?: string;
  linesTotal?: number;
  linesCovered?: number;
  coveragePercentage?: number;
  previousCoveragePercentage?: number;
  coverageDelta?: number;
  modules?: CoverageModule[];
  errorMessage?: string;
  createdAt: string;
  processedAt?: string;
}

export interface CoverageModule {
  id: string;
  modulePath: string;
  linesTotal: number;
  linesCovered: number;
  coveragePercentage: number;
}

export interface CoverageListResponse {
  reports: CoverageReport[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CoverageFilters {
  repositoryId?: string;
  status?: CoverageStatus;
  format?: CoverageFormat;
  branch?: string;
  commitSha?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface CoverageTrendFilters {
  branch?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

export interface CoverageTrendResponse {
  reports: Array<{
    id: string;
    coveragePercentage: number;
    coverageDelta?: number;
    commitSha?: string;
    branch?: string;
    createdAt: string;
  }>;
  statistics: {
    min: number;
    max: number;
    average: number;
    trend: 'improving' | 'declining' | 'stable';
  };
}

// ============== REVIEWS ==============

export type ReviewState = 'OPEN' | 'MERGED' | 'CLOSED' | 'DRAFT';

export interface Review {
  id: string;
  pullRequestId: number;
  pullRequestTitle: string;
  state: ReviewState;
  author: {
    id?: string;
    name: string;
    email: string;
  };
  reviewers: Array<{
    id?: string;
    name: string;
    email: string;
    reviewedAt?: string;
  }>;
  repositoryId: string;
  repository?: Repository;
  createdAt: string;
  updatedAt: string;
  mergedAt?: string;
  reviewedAt?: string;
  approvalCount: number;
  commentCount: number;
  linesAdded: number;
  linesRemoved: number;
}

export interface ReviewFilters {
  page?: number;
  pageSize?: number;
  organizationId?: string;
  repositoryId?: string;
  state?: ReviewState;
  authorId?: string;
  reviewerId?: string;
  startDate?: string;
  endDate?: string;
}

export interface ReviewLeaderboardEntry {
  userId: string;
  name: string;
  avatarUrl?: string;
  reviewsCompleted: number;
  avgReviewTurnaround: number;
  totalComments: number;
  approvalRate: number;
  score: number;
}

export interface ReviewAnalytics {
  totalReviews: number;
  averageTurnaroundHours: number;
  approvalRate: number;
  reviewsByState: Record<string, number>;
  topReviewers: ReviewLeaderboardEntry[];
}

export interface ReviewQualityMetrics {
  reviewsWithComments: number;
  avgCommentsPerReview: number;
  usefulCommentRate: number;
  nitpickRate: number;
  qualityScore: number;
}

export interface ReviewActivityTrendPoint {
  date: string;
  count: number;
}

export interface PeakReviewTimes {
  byHour: Array<{ hour: number; count: number }>;
  byDay: Array<{ day: string; count: number }>;
}

export interface ReviewDebt {
  teamId: string;
  teamName: string;
  totalReviews: number;
  pendingReviews: number;
  avgWaitingDays: number;
  oldestPendingReviewDays: number;
  score: number;
  items: Array<{
    id: string;
    pullRequestTitle: string;
    waitedDays: number;
    reviewers: string[];
    createdAt: string;
  }>;
}

export interface ReviewListResponse {
  data: Review[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface DeveloperReviewStats {
  userId: string;
  name: string;
  reviewsRequested: number;
  reviewsGiven: number;
  avgTimeToFirstReview: number;
  avgTimeToApproval: number;
  approvalRate: number;
}

// ============== GOALS ==============

export type GoalStatus = 'ACTIVE' | 'AT_RISK' | 'ACHIEVED' | 'FAILED';
export type GoalMetricType = 'DQS' | 'COVERAGE' | 'BUG_COUNT' | 'COMMIT_COUNT' | 'REVIEW_COUNT';
export type GoalOperator = 'GT' | 'LT' | 'EQ' | 'GTE' | 'LTE';

export interface Goal {
  id: string;
  name: string;
  description?: string;
  metricType?: GoalMetricType;
  operator?: GoalOperator;
  status: GoalStatus;
  organizationId: string;
  teamId?: string;
  team?: Team;
  projectId?: string;
  project?: Project;
  ownerId?: string;
  owner?: User;
  targetValue?: number;
  currentValue?: number;
  startDate?: string;
  endDate?: string;
  isPublic?: boolean;
  progress?: {
    percentage: number;
    isOnTrack: boolean;
    daysRemaining: number;
  };
  keyResults?: KeyResult[];
  createdAt: string;
  updatedAt: string;
  title?: string;
}

export interface KeyResult {
  id: string;
  goalId: string;
  title: string;
  targetValue: number;
  currentValue: number;
  unit?: string;
  weight?: number;
  status: 'NOT_STARTED' | 'ON_TRACK' | 'BEHIND' | 'COMPLETED';
  createdAt: string;
  updatedAt: string;
}

export interface CreateGoalRequest {
  name: string;
  description?: string;
  metricType?: GoalMetricType;
  operator?: GoalOperator;
  targetValue?: number;
  startDate: string;
  endDate?: string;
  teamId?: string;
  projectId?: string;
  ownerId?: string;
  isPublic?: boolean;
  keyResults?: CreateKeyResultRequest[];
  templateId?: string;
}

export interface UpdateGoalRequest {
  name?: string;
  description?: string;
  status?: GoalStatus;
  metricType?: GoalMetricType;
  operator?: GoalOperator;
  teamId?: string;
  projectId?: string;
  ownerId?: string;
  targetValue?: number;
  currentValue?: number;
  startDate?: string;
  endDate?: string;
  isPublic?: boolean;
}

export interface CreateKeyResultRequest {
  title: string;
  targetValue: number;
  currentValue?: number;
  unit?: string;
  weight?: number;
}

export interface UpdateKeyResultRequest {
  title?: string;
  targetValue?: number;
  currentValue?: number;
  unit?: string;
  weight?: number;
}

export interface GoalFilters {
  page?: number;
  limit?: number;
  status?: GoalStatus;
  metricType?: GoalMetricType;
  teamId?: string;
  projectId?: string;
  ownerId?: string;
  search?: string;
  isPublic?: boolean;
  includeKeyResults?: boolean;
}

export interface GoalsDashboardData {
  stats: {
    totalActive: number;
    completed: number;
    atRisk: number;
    avgProgress: number;
  };
  goals: Goal[];
}

export interface GoalTemplate {
  id: string;
  name: string;
  description?: string;
  category: string;
  organizationId: string;
  isDefault: boolean;
  fields: Record<string, unknown>;
  createdAt: string;
}

export interface GoalAchievement {
  id: string;
  goalId: string;
  goalTitle: string;
  achievedAt: string;
  finalProgress: number;
}

export interface GoalSnapshot {
  id: string;
  goalId: string;
  progress: number;
  currentValue?: number;
  snapshotAt: string;
}

export interface GoalHistoryEntry {
  id: string;
  goalId: string;
  snapshotDate: string;
  progress: number;
  status: GoalStatus;
  metadata?: Record<string, unknown>;
}

export interface GoalAchievementRatePoint {
  period: string;
  rate: number;
  achieved: number;
  total: number;
}

export interface GoalListResponse {
  data: Goal[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface TeamGoalComparison {
  teamId: string;
  teamName: string;
  completionRate: number;
  avgProgress: number;
  goalsCount: number;
}

// ============== DEBT ==============

export type DebtSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type DebtType = 'BUG_RISK' | 'COMPLEXITY' | 'DUPLICATION' | 'CODE_SMELL' | 'TEST_GAP' | 'DEPRECATION' | 'PERFORMANCE';

export interface DebtItem {
  id: string;
  title: string;
  description?: string;
  type: DebtType;
  severity: DebtSeverity;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'WONTFIX';
  repositoryId: string;
  repository?: Repository;
  modulePath?: string;
  lineStart?: number;
  lineEnd?: number;
  authorId?: string;
  introducedAt?: string;
  resolvedAt?: string;
  effortMinutes?: number;
  score: number;
  organizationId: string;
  createdAt: string;
}

export interface DebtListResponse {
  data: DebtItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface DebtFilters {
  page?: number;
  pageSize?: number;
  status?: DebtItem['status'];
  severity?: DebtSeverity;
  type?: DebtType;
  repositoryId?: string;
  modulePath?: string;
  startDate?: string;
  endDate?: string;
}

export interface DebtHotspot {
  filePath: string;
  repositoryId: string;
  repositoryName: string;
  churn: number;
  bugCount: number;
  complexity: number;
  severityScore: number;
  severity: DebtSeverity;
  lastModified: string;
}

export interface DebtTrend {
  data: Array<{
    date: string;
    totalDebt: number;
    newDebt: number;
    resolvedDebt: number;
    netDebt: number;
  }>;
  velocity: {
    accumulationRate: number;
    resolutionRate: number;
    status: 'increasing' | 'decreasing' | 'stable';
  };
}

export interface DebtRecommendation {
  id: string;
  title: string;
  description: string;
  filePath: string;
  repositoryName: string;
  estimatedEffortMinutes: number;
  impactScore: number;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface DebtAttribution {
  developerId: string;
  developerName: string;
  introduced: number;
  resolved: number;
  netDebt: number;
  avgSeverity: DebtSeverity;
}

export interface ModuleDebtScore {
  modulePath: string;
  repositoryId: string;
  score: number;
  markers: {
    bugs: number;
    codeSmells: number;
    complexity: number;
    duplications: number;
  };
}

// ============== ALERTS ==============

export type AlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AlertStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
export type AlertType = 'ANOMALY' | 'THRESHOLD' | 'QUALITY' | 'PERFORMANCE' | 'SECURITY' | 'OTHER';

export interface Alert {
  id: string;
  type: AlertType;
  title: string;
  message: string;
  severity: AlertSeverity;
  status: AlertStatus;
  repositoryId?: string;
  repository?: Repository;
  metricType?: string;
  metricValue?: number;
  thresholdValue?: number;
  acknowledgedBy?: {
    id: string;
    name: string;
  };
  acknowledgedAt?: string;
  resolvedBy?: {
    id: string;
    name: string;
  };
  resolvedAt?: string;
  resolutionNotes?: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface AlertFilters {
  page?: number;
  pageSize?: number;
  status?: AlertStatus;
  severity?: AlertSeverity;
  type?: AlertType;
  repositoryId?: string;
  startDate?: string;
  endDate?: string;
}

export interface AlertPreference {
  id: string;
  userId: string;
  emailEnabled: boolean;
  pushEnabled: boolean;
  inAppEnabled: boolean;
  digestFrequency: 'REAL_TIME' | 'HOURLY' | 'DAILY' | 'WEEKLY';
  types: AlertType[];
  minSeverity: AlertSeverity;
}

export interface UpdatePreferenceRequest {
  emailEnabled?: boolean;
  pushEnabled?: boolean;
  inAppEnabled?: boolean;
  digestFrequency?: AlertPreference['digestFrequency'];
  types?: AlertType[];
  minSeverity?: AlertSeverity;
}

export interface AlertThresholdConfig {
  id: string;
  organizationId: string;
  alertType: AlertType;
  metricType: string;
  warningThreshold: number;
  criticalThreshold: number;
  adjustmentWindowDays: number;
  autoAcknowledgeDays: number;
  cooldownHours: number;
  smsEnabled: boolean;
  slackEnabled: boolean;
  webhookUrl?: string;
  enabled: boolean;
  updatedBy?: string;
  updatedAt: string;
}

export interface AlertListResponse {
  data: Alert[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  severityBreakdown: Record<AlertSeverity, number>;
}

export interface CreateThresholdConfigRequest {
  alertType: AlertType;
  metricType: string;
  warningThreshold: number;
  criticalThreshold: number;
  adjustmentWindowDays?: number;
  autoAcknowledgeDays?: number;
  cooldownHours?: number;
  smsEnabled?: boolean;
  slackEnabled?: boolean;
  webhookUrl?: string;
  enabled?: boolean;
}

export interface UpdateThresholdConfigRequest {
  warningThreshold?: number;
  criticalThreshold?: number;
  adjustmentWindowDays?: number;
  autoAcknowledgeDays?: number;
  cooldownHours?: number;
  smsEnabled?: boolean;
  slackEnabled?: boolean;
  webhookUrl?: string;
  enabled?: boolean;
}

// ============== NOTIFICATIONS ==============

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  read: boolean;
  readAt?: string;
  createdAt: string;
}

export interface NotificationFilters {
  page?: number;
  pageSize?: number;
  read?: boolean;
  type?: string;
  startDate?: string;
  endDate?: string;
}

// ============== REPORTS ==============

export type ReportType = 'PDF' | 'CSV';
export type ReportStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
export type ReportCategory = 'DEVELOPER' | 'TEAM' | 'PROJECT' | 'ORGANIZATION' | 'SPRINT' | 'RELEASE';

export interface Report {
  id: string;
  type: ReportType;
  category: ReportCategory;
  title: string;
  description?: string;
  status: ReportStatus;
  filename: string;
  format: 'pdf' | 'csv';
  filters?: Record<string, unknown>;
  errorMessage?: string;
  organizationId: string;
  createdBy: string;
  createdByUser?: User;
  createdAt: string;
  completedAt?: string;
  downloadUrl?: string;
}

export interface CreateReportRequest {
  title: string;
  description?: string;
  category: ReportCategory;
  filters?: {
    startDate?: string;
    endDate?: string;
    teamId?: string;
    projectId?: string;
    repositoryId?: string;
    developerId?: string;
    sprintId?: string;
  };
}

export interface ReportFilters {
  page?: number;
  pageSize?: number;
  type?: ReportType;
  category?: ReportCategory;
  status?: ReportStatus;
  startDate?: string;
  endDate?: string;
}

export interface ReportListResponse {
  reports: Report[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface LeaderboardQuery {
  period?: 'week' | 'month' | 'quarter' | 'year' | 'all';
  startDate?: string;
  endDate?: string;
  teamId?: string;
  projectId?: string;
  limit?: number;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  avatarUrl?: string;
  dqs: number;
  sqs: number;
  commits: number;
  reviews: number;
  coverage: number;
  trend: number;
}

// ============== SCORES ==============

export interface DqsScore {
  score: number;
  trend: number;
  codeQuality: number;
  reviewSpeed: number;
  bugFixRate: number;
  modelVersion?: string;
  calculatedAt?: string;
  shapValues?: Record<string, number>;
  totalDebtHours?: number;
  qualityGate?: {
    status: 'PASSED' | 'WARNING' | 'FAILED';
    violations: Array<{
      file_path: string;
      rule: string;
      severity: 'CRITICAL' | 'WARNING' | 'INFO';
      message: string;
    }>;
  };
}

export interface SqsScore {
  score: number;
  trend: number;
  features: {
    code_coverage: number;
    commit_burstiness: number;
    commit_frequency: number;
    commit_message_score: number;
    lines_changed: number;
    refactoring_rate: number;
    review_coverage: number;
    test_additions: number;
  };
  modelVersion?: string;
  calculatedAt?: string;
  shapValues?: Record<string, number>;
}

export interface ScoreHistoryPoint {
  date: string;
  score: number;
  modelVersion?: string;
}

export interface ScoreHistoryResponse {
  data: ScoreHistoryPoint[];
  total: number;
}

export interface RiskModule {
  modulePath: string;
  riskScore: number;
  riskFactors: string[];
  recommendation: string;
}

export interface RecalculateRequest {
  entityId: string;
  type: 'DQS' | 'SQS';
}

// ============== GITHUB ==============

export interface GitHubConnectionStatus {
  isConnected?: boolean;
  connected?: boolean;
  username?: string;
  avatarUrl?: string;
  scopes?: string[];
  connectedAt?: string;
  enabledRepositoriesCount?: number;
  webhookStatus?: 'HEALTHY' | 'DEGRADED' | 'FAILED' | string;
  accountName?: string;
  organization?: string;
  lastSyncAt?: string;
}

export interface GitHubConnection {
  id: string;
  organizationId: string;
  username: string;
  avatarUrl?: string;
  scopes: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Repository {
  id: string;
  githubId?: number;
  name: string;
  fullName: string;
  description?: string;
  url: string;
  private: boolean;
  isPrivate?: boolean;
  isEnabled: boolean;
  isActive?: boolean;
  organizationId: string;
  defaultBranch: string;
  language?: string;
  lastSyncAt?: string;
  lastSyncedAt?: string;
  commitCount?: number;
  sqsScore?: number;
  createdAt: string;
}

export interface ConnectGitHubRequest {
  pat: string;
}

export interface EnableRepositoryRequest {
  defaultBranch?: string;
  webhookSecret?: string;
  autoBackfill?: boolean;
}

export interface WebhookLogEntry {
  id: string;
  deliveryId: string;
  eventType: string;
  repositoryId: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  responseTimeMs?: number;
  errorMessage?: string;
  payloadSize: number;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookHealthMetric {
  repositoryId: string;
  repositoryName: string;
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  successRate: number;
  averageResponseTimeMs: number;
  eventTypeCounts: Record<string, number>;
  period: string;
}

// ============== ONBOARDING ==============

export type OnboardingStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'AT_RISK' | 'EXTENDED';

export interface Onboarding {
  id: string;
  developerId: string;
  developer?: User;
  mentorId?: string;
  mentor?: User;
  teamId?: string;
  startDate: string;
  endDate: string;
  status: OnboardingStatus;
  progress: number;
  checklistItems: OnboardingChecklistItem[];
  templateId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OnboardingChecklistItem {
  id: string;
  onboardingId: string;
  title: string;
  description?: string;
  isCompleted: boolean;
  completedAt?: string;
  dueDate?: string;
  order: number;
}

export interface CreateOnboardingRequest {
  developerId: string;
  mentorId?: string;
  teamId?: string;
  startDate: string;
  endDate: string;
  templateId?: string;
  checklistItems?: Array<{
    title: string;
    description?: string;
    dueDate?: string;
  }>;
}

export interface ExtendOnboardingRequest {
  newEndDate: string;
  reason?: string;
}

export interface OnboardingTemplate {
  id: string;
  name: string;
  description?: string;
  organizationId: string;
  isDefault: boolean;
  items: Array<{
    id: string;
    title: string;
    description?: string;
    order: number;
  }>;
  createdAt: string;
}

export interface OnboardingVelocity {
  avgDaysToFirstPR: number;
  avgMilestoneCompletionDays: number;
  completionRate: number;
  trend: Array<{ week: string; avgDays: number }>;
}

export interface OnboardingDashboardStats {
  totalOnboardings: number;
  inProgress: number;
  completed: number;
  atRisk: number;
  avgCompletionDays: number;
}

export interface MentorCapacity {
  mentorId: string;
  name: string;
  currentMentees: number;
  maxCapacity: number;
  availableCapacity: number;
  activeMentees: Array<{
    id: string;
    name: string;
    status: OnboardingStatus;
  }>;
}

// ============== AUDIT LOGS ==============

export type AuditSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AuditAction = 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'ASSIGN' | 'EXPORT' | 'LOGIN' | 'LOGOUT' | 'FAILED' | 'OTHER' | string;

export interface AuditLog {
  id: string;
  organizationId: string;
  userId: string;
  user?: {
    id: string;
    email: string;
    name: string;
  };
  action: AuditAction;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  granted?: boolean;
  requiredRole?: string;
  userRole?: string;
  ipAddress?: string;
  userAgent?: string;
  severity?: AuditSeverity;
  timestamp: string;
}

export interface AuditLogFilters {
  page?: number;
  pageSize?: number;
  startDate?: string;
  endDate?: string;
  action?: string[];
  userId?: string;
  resourceType?: string;
  resourceId?: string;
  severity?: AuditSeverity;
  sortOrder?: 'asc' | 'desc';
}

export interface ExportAuditLogsRequest {
  format: 'CSV' | 'JSON';
  startDate?: string;
  endDate?: string;
  action?: string[];
  userId?: string;
  resourceType?: string;
  resourceId?: string;
  severity?: AuditSeverity;
}

export interface AuditExport {
  id: string;
  format: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
  downloadUrl?: string;
  estimatedRecords: number;
  createdAt: string;
  expiresAt: string;
}

export interface RetentionPolicy {
  id: string;
  organizationId: string;
  retentionDays: number;
  autoDelete: boolean;
  updatedAt: string;
}

export interface UpdateRetentionPolicyRequest {
  retentionDays: number;
  autoDelete: boolean;
}

export interface AuditAnalytics {
  actionCounts: Array<{
    action: string;
    count: number;
  }>;
  activeUsers: Array<{
    userId: string;
    name: string;
    count: number;
    lastActive: string;
  }>;
  failedPermissions: Array<{
    resource: string;
    count: number;
    severity: AuditSeverity;
  }>;
  timeline: Array<{
    timestamp: string;
    count: number;
  }>;
  topResources: Array<{
    resource: string;
    count: number;
  }>;
}

export interface ActionCountsAnalytics {
  action: string;
  count: number;
}

export interface ActiveUsersAnalytics {
  userId: string;
  name?: string;
  count: number;
  lastActive: string;
}

export interface FailedPermissionsAnalytics {
  resource: string;
  count: number;
  severity: AuditSeverity;
}

export interface TimelineAnalytics {
  timestamp: string;
  count: number;
}

export interface TopResourcesAnalytics {
  resource: string;
  count: number;
}

export interface ComplianceReport {
  id: string;
  organizationId: string;
  generatedAt: string;
  reportType: 'SOC2' | 'GDPR' | 'HIPAA';
  period: {
    startDate: string;
    endDate: string;
  };
  summary: {
    totalEntries: number;
    totalEvents: number;
    criticalEvents: number;
    failedAttempts: number;
    uniqueUsers: number;
  };
  details?: unknown;
}

export interface GdprDataAccessResponse {
  data: AuditLog[];
  total: number;
  page: number;
  pageSize: number;
}

export interface GdprAnonymizeResponse {
  anonymizedCount: number;
  anonymizedId: string;
}

// ============== EMAIL ALIASES ==============

export interface EmailAlias {
  id: string;
  userId: string;
  email: string;
  isVerified: boolean;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AddEmailAliasRequest {
  email: string;
}

export interface UnmappedEmail {
  id: string;
  email: string;
  commitCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface AssignEmailRequest {
  email: string;
  userId: string;
}

// ============== DEVELOPERS ==============

export interface Developer {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: UserRole;
  teamId?: string;
  team?: Team;
  dqs?: number;
  dqsTrend?: number;
  lastActive?: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface DeveloperStats {
  userId: string;
  name: string;
  dqs: number;
  dqsHistory: ScoreHistoryPoint[];
  commits: number;
  insertions: number;
  deletions: number;
  reviewsGiven: number;
  reviewsReceived: number;
  avgReviewTurnaround: number;
  codeCoverage: number;
  techDebtIntroduced: number;
  techDebtResolved: number;
  teams: Team[];
  recentCommits: Commit[];
}

export interface LeaderboardDeveloperEntry {
  rank: number;
  userId: string;
  name: string;
  avatarUrl?: string;
  dqs: number;
  commits: number;
  reviews: number;
  coverage: number;
  trend: number;
}
