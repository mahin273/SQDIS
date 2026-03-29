-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN', 'TEAM_LEAD', 'DEVELOPER');

-- CreateEnum
CREATE TYPE "AliasSource" AS ENUM ('MANUAL', 'GITHUB_OAUTH', 'ADMIN_ASSIGNED');

-- CreateEnum
CREATE TYPE "WebhookStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "PullRequestState" AS ENUM ('OPEN', 'CLOSED', 'MERGED');

-- CreateEnum
CREATE TYPE "IssueState" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "CommitClassification" AS ENUM ('BUGFIX', 'FEATURE', 'REFACTOR', 'TEST', 'DOCS');

-- CreateEnum
CREATE TYPE "ReviewState" AS ENUM ('PENDING', 'APPROVED', 'CHANGES_REQUESTED', 'COMMENTED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "TurnaroundClass" AS ENUM ('FAST', 'NORMAL', 'SLOW');

-- CreateEnum
CREATE TYPE "CommentClass" AS ENUM ('CONSTRUCTIVE', 'NITPICK', 'NEUTRAL');

-- CreateEnum
CREATE TYPE "SprintMetricType" AS ENUM ('DQS', 'COMMITS', 'BUGS_FIXED', 'BUG_REDUCTION', 'COVERAGE', 'FEATURE_COMMITS');

-- CreateEnum
CREATE TYPE "SprintGoalStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'ACHIEVED', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('SPRINT_REPORT_READY', 'ALERT', 'MILESTONE_ACHIEVED', 'MENTEE_MILESTONE', 'REVIEW_REQUESTED', 'MENTION', 'SYSTEM', 'GOAL_ACHIEVED');

-- CreateEnum
CREATE TYPE "DebtMarker" AS ENUM ('TODO', 'FIXME', 'HACK', 'XXX');

-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'EXTENDED');

-- CreateEnum
CREATE TYPE "MilestoneType" AS ENUM ('FIRST_COMMIT', 'FIRST_BUGFIX', 'FIRST_FEATURE', 'FIRST_REVIEW', 'FIRST_PR_MERGED', 'FIRST_TEST');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('ANOMALY', 'THRESHOLD', 'SYSTEM', 'WEBHOOK_FAILURE');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "MetricType" AS ENUM ('DQS', 'COVERAGE', 'BUG_COUNT', 'COMMIT_COUNT', 'REVIEW_COUNT');

-- CreateEnum
CREATE TYPE "ComparisonOp" AS ENUM ('GT', 'LT', 'EQ', 'GTE', 'LTE');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('ACTIVE', 'AT_RISK', 'ACHIEVED', 'FAILED');

-- CreateEnum
CREATE TYPE "ReportType" AS ENUM ('PDF', 'CSV');

-- CreateEnum
CREATE TYPE "ReportScope" AS ENUM ('ORGANIZATION', 'TEAM', 'PROJECT', 'DEVELOPER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "CoverageFormat" AS ENUM ('LCOV', 'COBERTURA', 'NYC_JSON', 'JACOCO');

-- CreateEnum
CREATE TYPE "CoverageStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AuditSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ExportFormat" AS ENUM ('CSV', 'JSON');

-- CreateEnum
CREATE TYPE "ExportStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "googleId" TEXT,
    "githubId" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organization_members" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'DEVELOPER',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_aliases" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifyToken" TEXT,
    "tokenExpiry" TIMESTAMP(3),
    "source" "AliasSource" NOT NULL DEFAULT 'MANUAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "email_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unmapped_emails" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "authorName" TEXT,
    "commitCount" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unmapped_emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "github_connections" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "encryptedPAT" TEXT NOT NULL,
    "scopes" TEXT[],
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "github_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repositories" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "githubId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "webhookId" INTEGER,
    "webhookSecret" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repositories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_logs" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "status" "WebhookStatus" NOT NULL DEFAULT 'PENDING',
    "responseTimeMs" INTEGER,
    "errorMessage" TEXT,
    "payloadSize" INTEGER NOT NULL,
    "payload" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_idempotency" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_idempotency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pull_requests" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "githubPrId" INTEGER NOT NULL,
    "prNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "state" "PullRequestState" NOT NULL,
    "merged" BOOLEAN NOT NULL DEFAULT false,
    "mergedAt" TIMESTAMP(3),
    "authorLogin" TEXT NOT NULL,
    "authorId" INTEGER NOT NULL,
    "baseBranch" TEXT NOT NULL,
    "headBranch" TEXT NOT NULL,
    "baseCommitSha" TEXT NOT NULL,
    "headCommitSha" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "pull_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issues" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "githubIssueId" INTEGER NOT NULL,
    "issueNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "state" "IssueState" NOT NULL,
    "authorLogin" TEXT NOT NULL,
    "authorId" INTEGER NOT NULL,
    "labels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "assignees" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "github_releases" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "githubReleaseId" INTEGER NOT NULL,
    "tagName" TEXT NOT NULL,
    "releaseName" TEXT,
    "body" TEXT,
    "isDraft" BOOLEAN NOT NULL DEFAULT false,
    "isPrerelease" BOOLEAN NOT NULL DEFAULT false,
    "authorLogin" TEXT NOT NULL,
    "authorId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "github_releases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commit_comments" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "commitId" TEXT,
    "githubCommentId" INTEGER NOT NULL,
    "commitSha" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "filePath" TEXT,
    "lineNumber" INTEGER,
    "authorLogin" TEXT NOT NULL,
    "authorId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commit_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_rate_limits" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "requestsPerMinute" INTEGER NOT NULL DEFAULT 100,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_rate_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commits" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "developerId" TEXT,
    "sha" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "authorEmail" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "classification" "CommitClassification",
    "linesAdded" INTEGER NOT NULL,
    "linesDeleted" INTEGER NOT NULL,
    "filesChanged" INTEGER NOT NULL,
    "churnRatio" DOUBLE PRECISION,
    "anomalyFlag" BOOLEAN NOT NULL DEFAULT false,
    "anomalyScore" DOUBLE PRECISION,
    "committedAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_changes" (
    "id" TEXT NOT NULL,
    "commitId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "additions" INTEGER NOT NULL,
    "deletions" INTEGER NOT NULL,
    "churnRatio" DOUBLE PRECISION,

    CONSTRAINT "file_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dqs_scores" (
    "id" TEXT NOT NULL,
    "developerId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "featureValues" JSONB NOT NULL,
    "shapValues" JSONB,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dqs_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sqs_scores" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "featureValues" JSONB NOT NULL,
    "riskyModules" JSONB,
    "recommendations" JSONB,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sqs_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "leadId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_memberships" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "team_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_repositories" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_repositories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_project_assignments" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),

    CONSTRAINT "team_project_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "githubReviewId" INTEGER NOT NULL,
    "githubPrId" INTEGER NOT NULL,
    "prNumber" INTEGER NOT NULL,
    "prTitle" TEXT NOT NULL,
    "prUrl" TEXT NOT NULL,
    "state" "ReviewState" NOT NULL DEFAULT 'PENDING',
    "body" TEXT,
    "turnaroundMinutes" INTEGER,
    "turnaroundClass" "TurnaroundClass",
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_comments" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "authorId" TEXT,
    "parentId" TEXT,
    "githubCommentId" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "filePath" TEXT,
    "lineNumber" INTEGER,
    "diffHunk" TEXT,
    "commentClass" "CommentClass",
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "review_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sprints" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sprints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sprint_reports" (
    "id" TEXT NOT NULL,
    "sprintId" TEXT NOT NULL,
    "totalCommits" INTEGER NOT NULL,
    "bugfixCommits" INTEGER NOT NULL,
    "featureCommits" INTEGER NOT NULL,
    "refactorCommits" INTEGER NOT NULL,
    "testCommits" INTEGER NOT NULL,
    "docsCommits" INTEGER NOT NULL,
    "bugsIntroduced" INTEGER NOT NULL,
    "bugsFixed" INTEGER NOT NULL,
    "avgDQS" DOUBLE PRECISION NOT NULL,
    "coveragePct" DOUBLE PRECISION NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sprint_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "releases" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "shippedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "releases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "release_sprint_associations" (
    "id" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "sprintId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "release_sprint_associations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sprint_goals" (
    "id" TEXT NOT NULL,
    "sprintId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "metricType" "SprintMetricType" NOT NULL,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "currentValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "SprintGoalStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sprint_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sprint_retrospectives" (
    "id" TEXT NOT NULL,
    "sprintId" TEXT NOT NULL,
    "wentWell" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "needsImprovement" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "actionItems" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sprint_retrospectives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sprint_carry_overs" (
    "id" TEXT NOT NULL,
    "fromSprintId" TEXT NOT NULL,
    "toSprintId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sprint_carry_overs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debt_items" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "introducedCommitId" TEXT,
    "resolvedCommitId" TEXT,
    "authorId" TEXT,
    "resolverId" TEXT,
    "markerType" "DebtMarker" NOT NULL,
    "content" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "debt_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboardings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mentorId" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "OnboardingStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "onboardings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_milestones" (
    "id" TEXT NOT NULL,
    "onboardingId" TEXT NOT NULL,
    "type" "MilestoneType" NOT NULL,
    "achievedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onboarding_milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_checklist_items" (
    "id" TEXT NOT NULL,
    "onboardingId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "order" INTEGER NOT NULL,

    CONSTRAINT "onboarding_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_templates" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onboarding_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "commitId" TEXT,
    "type" "AlertType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "message" TEXT NOT NULL,
    "anomalyScore" DOUBLE PRECISION,
    "modelVersion" TEXT,
    "status" "AlertStatus" NOT NULL DEFAULT 'OPEN',
    "acknowledgedBy" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "slackEnabled" BOOLEAN NOT NULL DEFAULT false,
    "slackWebhookUrl" TEXT,
    "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
    "quietStart" TEXT,
    "quietEnd" TEXT,
    "digestMode" BOOLEAN NOT NULL DEFAULT false,
    "digestFrequency" TEXT NOT NULL DEFAULT 'daily',
    "minSeverity" "AlertSeverity" NOT NULL DEFAULT 'MEDIUM',

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "digest_queue" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "alertType" "AlertType" NOT NULL,
    "alertSeverity" "AlertSeverity" NOT NULL,
    "alertMessage" TEXT NOT NULL,
    "alertCreatedAt" TIMESTAMP(3) NOT NULL,
    "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "digest_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert_threshold_configs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "alertType" "AlertType" NOT NULL DEFAULT 'ANOMALY',
    "lowThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "mediumThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "highThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "criticalThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.9,
    "minSeverity" "AlertSeverity" NOT NULL DEFAULT 'LOW',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "alert_threshold_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goals" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "teamId" TEXT,
    "projectId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "metricType" "MetricType" NOT NULL,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "currentValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "operator" "ComparisonOp" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "status" "GoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "achievedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "key_results" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "currentValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "key_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal_templates" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "metricType" "MetricType" NOT NULL,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "operator" "ComparisonOp" NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goal_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal_snapshots" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "teamId" TEXT,
    "projectId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "metricType" "MetricType" NOT NULL,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "finalValue" DOUBLE PRECISION NOT NULL,
    "operator" "ComparisonOp" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "finalStatus" "GoalStatus" NOT NULL,
    "progressPercentage" DOUBLE PRECISION NOT NULL,
    "wasAchieved" BOOLEAN NOT NULL,
    "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goal_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "type" "ReportType" NOT NULL,
    "scope" "ReportScope" NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "title" TEXT NOT NULL,
    "filename" TEXT,
    "filePath" TEXT,
    "fileSize" INTEGER,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "teamId" TEXT,
    "projectId" TEXT,
    "repositoryId" TEXT,
    "developerId" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coverage_reports" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "format" "CoverageFormat" NOT NULL,
    "status" "CoverageStatus" NOT NULL DEFAULT 'PENDING',
    "originalFilename" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileHash" TEXT NOT NULL,
    "commitSha" TEXT,
    "branch" TEXT,
    "linesTotal" INTEGER,
    "linesCovered" INTEGER,
    "coveragePercentage" DOUBLE PRECISION,
    "previousCoveragePercentage" DOUBLE PRECISION,
    "coverageDelta" DOUBLE PRECISION,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "coverage_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coverage_modules" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "modulePath" TEXT NOT NULL,
    "linesTotal" INTEGER NOT NULL,
    "linesCovered" INTEGER NOT NULL,
    "coveragePercentage" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "coverage_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "metadata" JSONB,
    "granted" BOOLEAN,
    "requiredRole" "Role",
    "userRole" "Role",
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "entryHash" TEXT NOT NULL,
    "previousEntryHash" TEXT,
    "severity" "AuditSeverity",

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "archived_audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "compressedMetadata" BYTEA,
    "granted" BOOLEAN,
    "requiredRole" "Role",
    "userRole" "Role",
    "timestamp" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "entryHash" TEXT NOT NULL,
    "previousEntryHash" TEXT,
    "severity" "AuditSeverity",
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "archived_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_retention_policies" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "defaultRetentionDays" INTEGER NOT NULL DEFAULT 90,
    "actionSpecificRetention" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audit_retention_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_exports" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "format" "ExportFormat" NOT NULL,
    "status" "ExportStatus" NOT NULL DEFAULT 'QUEUED',
    "filters" JSONB NOT NULL,
    "estimatedRecords" INTEGER NOT NULL,
    "actualRecords" INTEGER,
    "filename" TEXT,
    "s3Key" TEXT,
    "downloadUrl" TEXT,
    "expiresAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "audit_exports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_googleId_key" ON "users"("googleId");

-- CreateIndex
CREATE UNIQUE INDEX "users_githubId_key" ON "users"("githubId");

-- CreateIndex
CREATE UNIQUE INDEX "organization_members_organizationId_userId_key" ON "organization_members"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_token_key" ON "invitations"("token");

-- CreateIndex
CREATE UNIQUE INDEX "email_aliases_email_key" ON "email_aliases"("email");

-- CreateIndex
CREATE UNIQUE INDEX "unmapped_emails_organizationId_email_key" ON "unmapped_emails"("organizationId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "github_connections_organizationId_key" ON "github_connections"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "repositories_organizationId_githubId_key" ON "repositories"("organizationId", "githubId");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_logs_deliveryId_key" ON "webhook_logs"("deliveryId");

-- CreateIndex
CREATE INDEX "webhook_logs_repositoryId_createdAt_idx" ON "webhook_logs"("repositoryId", "createdAt");

-- CreateIndex
CREATE INDEX "webhook_logs_status_idx" ON "webhook_logs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_idempotency_deliveryId_key" ON "webhook_idempotency"("deliveryId");

-- CreateIndex
CREATE INDEX "webhook_idempotency_expiresAt_idx" ON "webhook_idempotency"("expiresAt");

-- CreateIndex
CREATE INDEX "pull_requests_repositoryId_state_idx" ON "pull_requests"("repositoryId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "pull_requests_repositoryId_githubPrId_key" ON "pull_requests"("repositoryId", "githubPrId");

-- CreateIndex
CREATE INDEX "issues_repositoryId_state_idx" ON "issues"("repositoryId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "issues_repositoryId_githubIssueId_key" ON "issues"("repositoryId", "githubIssueId");

-- CreateIndex
CREATE INDEX "github_releases_repositoryId_idx" ON "github_releases"("repositoryId");

-- CreateIndex
CREATE UNIQUE INDEX "github_releases_repositoryId_githubReleaseId_key" ON "github_releases"("repositoryId", "githubReleaseId");

-- CreateIndex
CREATE INDEX "commit_comments_repositoryId_commitSha_idx" ON "commit_comments"("repositoryId", "commitSha");

-- CreateIndex
CREATE UNIQUE INDEX "commit_comments_repositoryId_githubCommentId_key" ON "commit_comments"("repositoryId", "githubCommentId");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_rate_limits_organizationId_key" ON "webhook_rate_limits"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "commits_repositoryId_sha_key" ON "commits"("repositoryId", "sha");

-- CreateIndex
CREATE INDEX "dqs_scores_developerId_calculatedAt_idx" ON "dqs_scores"("developerId", "calculatedAt");

-- CreateIndex
CREATE INDEX "sqs_scores_projectId_calculatedAt_idx" ON "sqs_scores"("projectId", "calculatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "teams_organizationId_name_key" ON "teams"("organizationId", "name");

-- CreateIndex
CREATE INDEX "team_memberships_teamId_userId_idx" ON "team_memberships"("teamId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "projects_organizationId_name_key" ON "projects"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "project_repositories_projectId_repositoryId_key" ON "project_repositories"("projectId", "repositoryId");

-- CreateIndex
CREATE INDEX "team_project_assignments_teamId_projectId_idx" ON "team_project_assignments"("teamId", "projectId");

-- CreateIndex
CREATE INDEX "reviews_reviewerId_idx" ON "reviews"("reviewerId");

-- CreateIndex
CREATE INDEX "reviews_state_idx" ON "reviews"("state");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_repositoryId_githubReviewId_key" ON "reviews"("repositoryId", "githubReviewId");

-- CreateIndex
CREATE INDEX "review_comments_authorId_idx" ON "review_comments"("authorId");

-- CreateIndex
CREATE UNIQUE INDEX "review_comments_reviewId_githubCommentId_key" ON "review_comments"("reviewId", "githubCommentId");

-- CreateIndex
CREATE INDEX "sprints_organizationId_idx" ON "sprints"("organizationId");

-- CreateIndex
CREATE INDEX "sprints_teamId_idx" ON "sprints"("teamId");

-- CreateIndex
CREATE INDEX "sprint_reports_sprintId_idx" ON "sprint_reports"("sprintId");

-- CreateIndex
CREATE INDEX "releases_organizationId_idx" ON "releases"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "releases_organizationId_version_key" ON "releases"("organizationId", "version");

-- CreateIndex
CREATE INDEX "release_sprint_associations_releaseId_idx" ON "release_sprint_associations"("releaseId");

-- CreateIndex
CREATE INDEX "release_sprint_associations_sprintId_idx" ON "release_sprint_associations"("sprintId");

-- CreateIndex
CREATE UNIQUE INDEX "release_sprint_associations_releaseId_sprintId_key" ON "release_sprint_associations"("releaseId", "sprintId");

-- CreateIndex
CREATE INDEX "sprint_goals_sprintId_idx" ON "sprint_goals"("sprintId");

-- CreateIndex
CREATE UNIQUE INDEX "sprint_retrospectives_sprintId_key" ON "sprint_retrospectives"("sprintId");

-- CreateIndex
CREATE INDEX "sprint_carry_overs_fromSprintId_idx" ON "sprint_carry_overs"("fromSprintId");

-- CreateIndex
CREATE INDEX "sprint_carry_overs_toSprintId_idx" ON "sprint_carry_overs"("toSprintId");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");

-- CreateIndex
CREATE INDEX "notifications_organizationId_idx" ON "notifications"("organizationId");

-- CreateIndex
CREATE INDEX "debt_items_repositoryId_idx" ON "debt_items"("repositoryId");

-- CreateIndex
CREATE INDEX "debt_items_authorId_idx" ON "debt_items"("authorId");

-- CreateIndex
CREATE INDEX "debt_items_isResolved_idx" ON "debt_items"("isResolved");

-- CreateIndex
CREATE INDEX "debt_items_filePath_idx" ON "debt_items"("filePath");

-- CreateIndex
CREATE UNIQUE INDEX "onboardings_userId_key" ON "onboardings"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_milestones_onboardingId_type_key" ON "onboarding_milestones"("onboardingId", "type");

-- CreateIndex
CREATE INDEX "alerts_organizationId_idx" ON "alerts"("organizationId");

-- CreateIndex
CREATE INDEX "alerts_severity_idx" ON "alerts"("severity");

-- CreateIndex
CREATE INDEX "alerts_status_idx" ON "alerts"("status");

-- CreateIndex
CREATE INDEX "alerts_createdAt_idx" ON "alerts"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_userId_key" ON "notification_preferences"("userId");

-- CreateIndex
CREATE INDEX "digest_queue_userId_processed_idx" ON "digest_queue"("userId", "processed");

-- CreateIndex
CREATE INDEX "digest_queue_processedAt_idx" ON "digest_queue"("processedAt");

-- CreateIndex
CREATE INDEX "alert_threshold_configs_organizationId_idx" ON "alert_threshold_configs"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "alert_threshold_configs_organizationId_alertType_key" ON "alert_threshold_configs"("organizationId", "alertType");

-- CreateIndex
CREATE INDEX "goals_organizationId_idx" ON "goals"("organizationId");

-- CreateIndex
CREATE INDEX "goals_ownerId_idx" ON "goals"("ownerId");

-- CreateIndex
CREATE INDEX "goals_teamId_idx" ON "goals"("teamId");

-- CreateIndex
CREATE INDEX "goals_status_idx" ON "goals"("status");

-- CreateIndex
CREATE INDEX "key_results_goalId_idx" ON "key_results"("goalId");

-- CreateIndex
CREATE INDEX "goal_templates_organizationId_idx" ON "goal_templates"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "goal_templates_organizationId_name_key" ON "goal_templates"("organizationId", "name");

-- CreateIndex
CREATE INDEX "goal_snapshots_organizationId_idx" ON "goal_snapshots"("organizationId");

-- CreateIndex
CREATE INDEX "goal_snapshots_ownerId_idx" ON "goal_snapshots"("ownerId");

-- CreateIndex
CREATE INDEX "goal_snapshots_teamId_idx" ON "goal_snapshots"("teamId");

-- CreateIndex
CREATE INDEX "goal_snapshots_snapshotAt_idx" ON "goal_snapshots"("snapshotAt");

-- CreateIndex
CREATE INDEX "reports_organizationId_idx" ON "reports"("organizationId");

-- CreateIndex
CREATE INDEX "reports_createdById_idx" ON "reports"("createdById");

-- CreateIndex
CREATE INDEX "reports_status_idx" ON "reports"("status");

-- CreateIndex
CREATE INDEX "reports_createdAt_idx" ON "reports"("createdAt");

-- CreateIndex
CREATE INDEX "coverage_reports_repositoryId_idx" ON "coverage_reports"("repositoryId");

-- CreateIndex
CREATE INDEX "coverage_reports_status_idx" ON "coverage_reports"("status");

-- CreateIndex
CREATE INDEX "coverage_reports_createdAt_idx" ON "coverage_reports"("createdAt");

-- CreateIndex
CREATE INDEX "coverage_modules_reportId_idx" ON "coverage_modules"("reportId");

-- CreateIndex
CREATE INDEX "coverage_modules_modulePath_idx" ON "coverage_modules"("modulePath");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_key" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE INDEX "password_reset_tokens_userId_idx" ON "password_reset_tokens"("userId");

-- CreateIndex
CREATE INDEX "password_reset_tokens_expiresAt_idx" ON "password_reset_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_organizationId_idx" ON "audit_logs"("organizationId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_resourceType_idx" ON "audit_logs"("resourceType");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_severity_idx" ON "audit_logs"("severity");

-- CreateIndex
CREATE INDEX "audit_logs_entryHash_idx" ON "audit_logs"("entryHash");

-- CreateIndex
CREATE INDEX "archived_audit_logs_userId_idx" ON "archived_audit_logs"("userId");

-- CreateIndex
CREATE INDEX "archived_audit_logs_organizationId_idx" ON "archived_audit_logs"("organizationId");

-- CreateIndex
CREATE INDEX "archived_audit_logs_action_idx" ON "archived_audit_logs"("action");

-- CreateIndex
CREATE INDEX "archived_audit_logs_resourceType_idx" ON "archived_audit_logs"("resourceType");

-- CreateIndex
CREATE INDEX "archived_audit_logs_timestamp_idx" ON "archived_audit_logs"("timestamp");

-- CreateIndex
CREATE INDEX "archived_audit_logs_archivedAt_idx" ON "archived_audit_logs"("archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "audit_retention_policies_organizationId_key" ON "audit_retention_policies"("organizationId");

-- CreateIndex
CREATE INDEX "audit_exports_userId_idx" ON "audit_exports"("userId");

-- CreateIndex
CREATE INDEX "audit_exports_organizationId_idx" ON "audit_exports"("organizationId");

-- CreateIndex
CREATE INDEX "audit_exports_status_idx" ON "audit_exports"("status");

-- CreateIndex
CREATE INDEX "audit_exports_createdAt_idx" ON "audit_exports"("createdAt");

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_aliases" ADD CONSTRAINT "email_aliases_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unmapped_emails" ADD CONSTRAINT "unmapped_emails_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "github_connections" ADD CONSTRAINT "github_connections_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_logs" ADD CONSTRAINT "webhook_logs_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pull_requests" ADD CONSTRAINT "pull_requests_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "github_releases" ADD CONSTRAINT "github_releases_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commit_comments" ADD CONSTRAINT "commit_comments_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commit_comments" ADD CONSTRAINT "commit_comments_commitId_fkey" FOREIGN KEY ("commitId") REFERENCES "commits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_rate_limits" ADD CONSTRAINT "webhook_rate_limits_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commits" ADD CONSTRAINT "commits_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commits" ADD CONSTRAINT "commits_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_changes" ADD CONSTRAINT "file_changes_commitId_fkey" FOREIGN KEY ("commitId") REFERENCES "commits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dqs_scores" ADD CONSTRAINT "dqs_scores_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_repositories" ADD CONSTRAINT "project_repositories_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_repositories" ADD CONSTRAINT "project_repositories_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_project_assignments" ADD CONSTRAINT "team_project_assignments_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_project_assignments" ADD CONSTRAINT "team_project_assignments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_comments" ADD CONSTRAINT "review_comments_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_comments" ADD CONSTRAINT "review_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_comments" ADD CONSTRAINT "review_comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "review_comments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sprints" ADD CONSTRAINT "sprints_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sprints" ADD CONSTRAINT "sprints_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sprint_reports" ADD CONSTRAINT "sprint_reports_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "sprints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "releases" ADD CONSTRAINT "releases_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "release_sprint_associations" ADD CONSTRAINT "release_sprint_associations_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "releases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "release_sprint_associations" ADD CONSTRAINT "release_sprint_associations_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "sprints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sprint_goals" ADD CONSTRAINT "sprint_goals_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "sprints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sprint_retrospectives" ADD CONSTRAINT "sprint_retrospectives_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "sprints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sprint_carry_overs" ADD CONSTRAINT "sprint_carry_overs_fromSprintId_fkey" FOREIGN KEY ("fromSprintId") REFERENCES "sprints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sprint_carry_overs" ADD CONSTRAINT "sprint_carry_overs_toSprintId_fkey" FOREIGN KEY ("toSprintId") REFERENCES "sprints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt_items" ADD CONSTRAINT "debt_items_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt_items" ADD CONSTRAINT "debt_items_introducedCommitId_fkey" FOREIGN KEY ("introducedCommitId") REFERENCES "commits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt_items" ADD CONSTRAINT "debt_items_resolvedCommitId_fkey" FOREIGN KEY ("resolvedCommitId") REFERENCES "commits"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt_items" ADD CONSTRAINT "debt_items_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt_items" ADD CONSTRAINT "debt_items_resolverId_fkey" FOREIGN KEY ("resolverId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboardings" ADD CONSTRAINT "onboardings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboardings" ADD CONSTRAINT "onboardings_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_milestones" ADD CONSTRAINT "onboarding_milestones_onboardingId_fkey" FOREIGN KEY ("onboardingId") REFERENCES "onboardings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_checklist_items" ADD CONSTRAINT "onboarding_checklist_items_onboardingId_fkey" FOREIGN KEY ("onboardingId") REFERENCES "onboardings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_acknowledgedBy_fkey" FOREIGN KEY ("acknowledgedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_resolvedBy_fkey" FOREIGN KEY ("resolvedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "digest_queue" ADD CONSTRAINT "digest_queue_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "digest_queue" ADD CONSTRAINT "digest_queue_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "digest_queue" ADD CONSTRAINT "digest_queue_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "alerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_threshold_configs" ADD CONSTRAINT "alert_threshold_configs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "key_results" ADD CONSTRAINT "key_results_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_templates" ADD CONSTRAINT "goal_templates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coverage_reports" ADD CONSTRAINT "coverage_reports_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coverage_modules" ADD CONSTRAINT "coverage_modules_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "coverage_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_retention_policies" ADD CONSTRAINT "audit_retention_policies_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
