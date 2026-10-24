-- CreateEnum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RemovalRequestStatus') THEN
    CREATE TYPE "RemovalRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
  END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "member_removal_requests" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "reason" TEXT,
    "status" "RemovalRequestStatus" NOT NULL DEFAULT 'PENDING',
    "approverId" TEXT,
    "decisionReason" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "member_removal_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "member_removal_requests_organizationId_status_idx" ON "member_removal_requests"("organizationId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "member_removal_requests_targetUserId_idx" ON "member_removal_requests"("targetUserId");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'member_removal_requests_organizationId_fkey'
  ) THEN
    ALTER TABLE "member_removal_requests" ADD CONSTRAINT "member_removal_requests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'member_removal_requests_requesterId_fkey'
  ) THEN
    ALTER TABLE "member_removal_requests" ADD CONSTRAINT "member_removal_requests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'member_removal_requests_targetUserId_fkey'
  ) THEN
    ALTER TABLE "member_removal_requests" ADD CONSTRAINT "member_removal_requests_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'member_removal_requests_approverId_fkey'
  ) THEN
    ALTER TABLE "member_removal_requests" ADD CONSTRAINT "member_removal_requests_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
