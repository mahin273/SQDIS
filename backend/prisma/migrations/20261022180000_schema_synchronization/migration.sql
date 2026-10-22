-- CreateEnum if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'QualityGateStatus') THEN
    CREATE TYPE "QualityGateStatus" AS ENUM ('PASSED', 'WARNING', 'BLOCKED');
  END IF;
END $$;

-- AlterEnum
ALTER TYPE "ReportScope" ADD VALUE IF NOT EXISTS 'REPOSITORY';

-- DropIndex
DROP INDEX IF EXISTS "releases_organizationId_version_key";

-- AlterTable
ALTER TABLE "releases" ADD COLUMN IF NOT EXISTS "isRolledBack" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "repositoryId" TEXT,
ADD COLUMN IF NOT EXISTS "rollbackReason" TEXT,
ADD COLUMN IF NOT EXISTS "rollbackTriggeredBy" TEXT,
ADD COLUMN IF NOT EXISTS "rollbackWebhookUrl" TEXT,
ADD COLUMN IF NOT EXISTS "rolledBackAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "file_ast_metrics" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "cyclomaticComplexity" INTEGER NOT NULL,
    "cognitiveComplexity" INTEGER NOT NULL,
    "maintainabilityIndex" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "file_ast_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "pull_request_quality_gates" (
    "id" TEXT NOT NULL,
    "pullRequestId" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "prNumber" INTEGER NOT NULL,
    "headCommitSha" TEXT NOT NULL,
    "status" "QualityGateStatus" NOT NULL,
    "defectProbability" DOUBLE PRECISION NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "maxComplexity" INTEGER NOT NULL,
    "impactedTestsCount" INTEGER NOT NULL,
    "prunedPercentage" DOUBLE PRECISION NOT NULL,
    "estimatedTimeSaved" DOUBLE PRECISION NOT NULL,
    "summaryMarkdown" TEXT NOT NULL,
    "githubCommentId" BIGINT,
    "githubStatusState" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pull_request_quality_gates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "quality_gate_policies" (
    "id" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "warningDefectProbability" DOUBLE PRECISION NOT NULL DEFAULT 0.40,
    "blockedDefectProbability" DOUBLE PRECISION NOT NULL DEFAULT 0.65,
    "warningComplexity" INTEGER NOT NULL DEFAULT 15,
    "blockedComplexity" INTEGER NOT NULL DEFAULT 25,
    "blockOnSecurity" BOOLEAN NOT NULL DEFAULT true,
    "enableBotComment" BOOLEAN NOT NULL DEFAULT true,
    "enableCommitStatus" BOOLEAN NOT NULL DEFAULT true,
    "strictBranchProtection" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quality_gate_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "release_telemetry_analyses" (
    "id" TEXT NOT NULL,
    "releaseId" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL DEFAULT 'sqdis-backend',
    "verdict" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "shouldRollback" BOOLEAN NOT NULL DEFAULT false,
    "p95BaselineMs" DOUBLE PRECISION NOT NULL,
    "p95CanaryMs" DOUBLE PRECISION NOT NULL,
    "p95DeltaPct" DOUBLE PRECISION NOT NULL,
    "errorBaseline" DOUBLE PRECISION NOT NULL,
    "errorCanary" DOUBLE PRECISION NOT NULL,
    "errorDelta" DOUBLE PRECISION NOT NULL,
    "memoryBaselineMb" DOUBLE PRECISION NOT NULL,
    "memoryCanaryMb" DOUBLE PRECISION NOT NULL,
    "memoryDeltaPct" DOUBLE PRECISION NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "violations" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "release_telemetry_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "defect_predictions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "repositoryId" TEXT,
    "commitSha" TEXT,
    "filePath" TEXT,
    "defectProbability" DOUBLE PRECISION NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "isDefectProne" BOOLEAN NOT NULL DEFAULT false,
    "metricsAnalyzed" JSONB,
    "topRiskDrivers" TEXT[],
    "modelVersion" TEXT NOT NULL,
    "benchmark" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "defect_predictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "team_bus_factor_snapshots" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "teamId" TEXT,
    "projectId" TEXT,
    "repositoryName" TEXT NOT NULL,
    "overallBusFactor" INTEGER NOT NULL,
    "averageGini" DOUBLE PRECISION NOT NULL,
    "totalModules" INTEGER NOT NULL,
    "criticalSilosCount" INTEGER NOT NULL,
    "vulnerableCount" INTEGER NOT NULL,
    "resilientCount" INTEGER NOT NULL,
    "moduleDetails" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_bus_factor_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "file_ast_metrics_repositoryId_filePath_key" ON "file_ast_metrics"("repositoryId", "filePath");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pull_request_quality_gates_repositoryId_prNumber_idx" ON "pull_request_quality_gates"("repositoryId", "prNumber");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "quality_gate_policies_repositoryId_key" ON "quality_gate_policies"("repositoryId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "release_telemetry_analyses_releaseId_idx" ON "release_telemetry_analyses"("releaseId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "release_telemetry_analyses_createdAt_idx" ON "release_telemetry_analyses"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "defect_predictions_organizationId_idx" ON "defect_predictions"("organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "defect_predictions_repositoryId_idx" ON "defect_predictions"("repositoryId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "defect_predictions_commitSha_idx" ON "defect_predictions"("commitSha");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "defect_predictions_isDefectProne_idx" ON "defect_predictions"("isDefectProne");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "defect_predictions_createdAt_idx" ON "defect_predictions"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "team_bus_factor_snapshots_organizationId_idx" ON "team_bus_factor_snapshots"("organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "team_bus_factor_snapshots_teamId_idx" ON "team_bus_factor_snapshots"("teamId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "team_bus_factor_snapshots_projectId_idx" ON "team_bus_factor_snapshots"("projectId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "team_bus_factor_snapshots_createdAt_idx" ON "team_bus_factor_snapshots"("createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "releases_repositoryId_idx" ON "releases"("repositoryId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "releases_repositoryId_version_key" ON "releases"("repositoryId", "version");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "reports_repositoryId_idx" ON "reports"("repositoryId");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'file_ast_metrics_repositoryId_fkey') THEN
    ALTER TABLE "file_ast_metrics" ADD CONSTRAINT "file_ast_metrics_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pull_request_quality_gates_pullRequestId_fkey') THEN
    ALTER TABLE "pull_request_quality_gates" ADD CONSTRAINT "pull_request_quality_gates_pullRequestId_fkey" FOREIGN KEY ("pullRequestId") REFERENCES "pull_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quality_gate_policies_repositoryId_fkey') THEN
    ALTER TABLE "quality_gate_policies" ADD CONSTRAINT "quality_gate_policies_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'releases_repositoryId_fkey') THEN
    ALTER TABLE "releases" ADD CONSTRAINT "releases_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'release_telemetry_analyses_releaseId_fkey') THEN
    ALTER TABLE "release_telemetry_analyses" ADD CONSTRAINT "release_telemetry_analyses_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "releases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reports_repositoryId_fkey') THEN
    ALTER TABLE "reports" ADD CONSTRAINT "reports_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "repositories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
