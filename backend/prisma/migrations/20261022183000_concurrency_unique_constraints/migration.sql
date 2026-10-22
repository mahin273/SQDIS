-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "sprint_reports_sprintId_key" ON "sprint_reports"("sprintId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "goal_snapshots_goalId_key" ON "goal_snapshots"("goalId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "coverage_reports_repositoryId_fileHash_key" ON "coverage_reports"("repositoryId", "fileHash");
