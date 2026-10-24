import { Injectable, Logger, BadGatewayException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service.js';
import { DataFilterService } from '../auth/services/data-filter.service.js';
import {
  AstDefectDto,
  CommitRiskDto,
  TestImpactDto,
  CanaryAnalysisDto,
  TreemapNodeDto,
  QuadrantFileInfo,
  RepositoryTreemapResponseDto,
} from './dto/index.js';

@Injectable()
export class CodeIntelligenceService {
  private readonly logger = new Logger(CodeIntelligenceService.name);
  private readonly mlServiceUrl: string;
  private readonly mlServiceSecret: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly dataFilterService?: DataFilterService,
  ) {
    this.mlServiceUrl = this.configService.get<string>('ML_SERVICE_URL', 'http://ml-service:8000');
    this.mlServiceSecret = this.configService.get<string>('ML_SERVICE_SECRET', 'sqdis-ml-internal-secret-token');
  }

  private getHeaders(customHeaders: Record<string, string> = {}): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-Service-Key': this.mlServiceSecret,
      ...customHeaders,
    };
  }

  /**
   * Predict module defect probability using the NASA MDP AST model and persist the audit record.
   */
  async predictAstDefect(dto: AstDefectDto, organizationId?: string, repositoryId?: string) {
    try {
      const payload = {
        file_path: dto.filePath,
        content: dto.content,
        loc: dto.loc,
        cyclomatic_complexity: dto.cyclomaticComplexity,
        halstead_volume: dto.halsteadVolume,
        halstead_difficulty: dto.halsteadDifficulty,
        halstead_effort: dto.halsteadEffort,
      };

      const resp = await fetch(`${this.mlServiceUrl}/api/ml/defects/predict-module`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const errorText = await resp.text();
        this.logger.error(`ML predict-module failed (${resp.status}): ${errorText}`);
        throw new BadGatewayException(`ML Service defect prediction failed: ${resp.statusText}`);
      }

      const mlResult = await resp.json();

      // Persist prediction in PostgreSQL
      const saved = await this.prisma.defectPrediction.create({
        data: {
          organizationId: organizationId || null,
          repositoryId: repositoryId || null,
          filePath: mlResult.file_path || dto.filePath || 'unspecified',
          defectProbability: mlResult.defect_probability,
          riskLevel: mlResult.risk_level,
          isDefectProne: mlResult.is_defect_prone,
          metricsAnalyzed: mlResult.metrics_analyzed || {},
          topRiskDrivers: mlResult.top_risk_drivers || [],
          modelVersion: mlResult.model_version || '1.0.0-nasa-xgboost',
          benchmark: mlResult.benchmark || 'NASA MDP',
        },
      });

      return {
        id: saved.id,
        ...mlResult,
        createdAt: saved.createdAt,
      };
    } catch (err) {
      this.logger.error(`Failed in predictAstDefect: ${err.message}`);
      throw err;
    }
  }

  /**
   * Predict commit defect risk using Kamei JIT model and persist the audit record.
   */
  async predictCommitRisk(dto: CommitRiskDto, organizationId?: string, repositoryId?: string) {
    try {
      const payload = {
        commit_sha: dto.commitSha,
        added_lines: dto.addedLines,
        deleted_lines: dto.deletedLines,
        modified_files_count: dto.modifiedFilesCount,
        max_cyclomatic_complexity: dto.maxCyclomaticComplexity,
        author_experience_commits: dto.authorExperienceCommits,
        directory_entropy: dto.directoryEntropy,
      };

      const resp = await fetch(`${this.mlServiceUrl}/api/ml/defects/predict`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const errorText = await resp.text();
        this.logger.error(`ML predict commit risk failed (${resp.status}): ${errorText}`);
        throw new BadGatewayException(`ML Service commit risk prediction failed: ${resp.statusText}`);
      }

      const mlResult = await resp.json();

      // Persist prediction in PostgreSQL
      const saved = await this.prisma.defectPrediction.create({
        data: {
          organizationId: organizationId || null,
          repositoryId: repositoryId || dto.repositoryId || null,
          commitSha: dto.commitSha || null,
          defectProbability: mlResult.defect_probability,
          riskLevel: mlResult.risk_level,
          isDefectProne: mlResult.is_defect_prone,
          metricsAnalyzed: {
            added_lines: dto.addedLines,
            deleted_lines: dto.deletedLines,
            modified_files_count: dto.modifiedFilesCount,
          },
          topRiskDrivers: mlResult.top_risk_drivers || [],
          modelVersion: mlResult.model_version || '1.0.0-jit-xgboost',
          benchmark: 'Kamei JIT',
        },
      });

      return {
        id: saved.id,
        ...mlResult,
        createdAt: saved.createdAt,
      };
    } catch (err) {
      this.logger.error(`Failed in predictCommitRisk: ${err.message}`);
      throw err;
    }
  }

  /**
   * Run Test Impact Analysis via dependency DAG.
   */
  async analyzeTestImpact(dto: TestImpactDto) {
    try {
      let filesList: Array<{ path: string; content: string }> = [];
      if (dto.fileContents && Object.keys(dto.fileContents).length > 0) {
        filesList = Object.entries(dto.fileContents).map(([p, c]) => ({ path: p, content: c }));
      } else {
        // Build representation for changed files and candidate test suites
        filesList = (dto.changedFiles || []).map((p) => ({
          path: p,
          content: `// ${p}\nexport function mod() {}`,
        }));
        const baseNames = (dto.changedFiles || []).map((p) => p.replace(/\.[^/.]+$/, ''));
        for (const base of baseNames) {
          filesList.push({
            path: `${base}.spec.ts`,
            content: `import { mod } from './${base.split('/').pop()}';\ndescribe('test', () => {});`,
          });
        }

        // If repositoryId is provided, pull real repository files from fileASTMetric
        if (dto.repositoryId) {
          const repoAstFiles = await this.prisma.fileASTMetric.findMany({
            where: { repositoryId: dto.repositoryId },
            select: { filePath: true },
            take: 50,
          });
          for (const rf of repoAstFiles) {
            if (!filesList.some((f) => f.path === rf.filePath)) {
              filesList.push({
                path: rf.filePath,
                content: `// ${rf.filePath}\nexport function file() {}`,
              });
            }
          }
        }
      }

      const payload = {
        files: filesList,
        changed_files: dto.changedFiles || [],
        test_file_patterns: dto.testFiles && dto.testFiles.length > 0 ? dto.testFiles : ['*.spec.*', '*.test.*', '*_test.*', 'test_*.*'],
        repository_id: dto.repositoryId || dto.repositoryRoot || 'default-repo',
      };

      const resp = await fetch(`${this.mlServiceUrl}/api/ml/code-quality/test-impact`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const errBody = await resp.text();
        this.logger.error(`ML TIA failed (${resp.status}): ${errBody}`);
        throw new BadGatewayException(`ML Service TIA failed: ${resp.statusText}`);
      }

      const mlResult = await resp.json();
      const timeSavings = mlResult.time_savings_percentage ?? 0;
      const totalTests = mlResult.total_tests_in_repo ?? 0;
      const impactedTests = mlResult.impacted_test_files ?? [];
      const impactedTestsCount = mlResult.impacted_tests_count ?? impactedTests.length;
      const estimatedTimeSaved = Math.round((timeSavings / 100) * 180);

      return {
        ...mlResult,
        prunedPercentage: timeSavings,
        totalTests,
        impactedTests,
        impactedTestsCount,
        estimatedTimeSavedSeconds: estimatedTimeSaved,
        riskCategory: impactedTestsCount > 2 ? 'MODERATE' : 'LOW',
      };
    } catch (err) {
      this.logger.error(`Failed in analyzeTestImpact: ${err.message}`);
      throw err;
    }
  }

  /**
   * Run live Canary Telemetry Regression analysis.
   */
  async analyzeCanary(dto: CanaryAnalysisDto) {
    try {
      const payload = {
        baseline_window_seconds: dto.baselineWindowSeconds || 600,
        canary_window_seconds: dto.canaryWindowSeconds || 300,
        latency_threshold_pct: dto.latencyThresholdPct || 20.0,
      };

      const resp = await fetch(`${this.mlServiceUrl}/api/ml/telemetry/canary-analysis`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        throw new BadGatewayException(`ML Service Canary Analysis failed: ${resp.statusText}`);
      }

      return await resp.json();
    } catch (err) {
      this.logger.error(`Failed in analyzeCanary: ${err.message}`);
      throw err;
    }
  }

  /**
   * Run structural code quality analysis (complexity, security, smells) via ML service.
   */
  async analyzeCodeQuality(files: Array<{ path: string; content: string }>, repositoryId?: string) {
    try {
      const resp = await fetch(`${this.mlServiceUrl}/api/ml/code-quality/analyze`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          files,
          repository_id: repositoryId,
        }),
      });

      if (!resp.ok) {
        const errorText = await resp.text();
        this.logger.error(`ML code quality analysis failed (${resp.status}): ${errorText}`);
        throw new BadGatewayException(`ML Service code quality analysis failed: ${resp.statusText}`);
      }

      return await resp.json();
    } catch (err) {
      this.logger.error(`Failed in analyzeCodeQuality: ${err.message}`);
      throw err;
    }
  }

  /**
   * Aggregate team commit and churn history from PostgreSQL, calculate Bus Factor via ML service,
   * and persist the audit snapshot.
   */
  async calculateTeamBusFactor(teamId: string, organizationId?: string, caller?: { id: string; role?: string }) {
    if (organizationId && caller && this.dataFilterService) {
      await this.dataFilterService.verifyTeamAccess(teamId, organizationId, caller);
    }
    const team = await this.prisma.team.findFirst({
      where: organizationId ? { id: teamId, organizationId } : { id: teamId },
      include: {
        memberships: {
          include: {
            user: true,
          },
        },
        projectAssignments: {
          include: {
            project: {
              include: {
                repositories: {
                  include: {
                    repository: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!team) {
      throw new NotFoundException(`Team with ID ${teamId} not found`);
    }

    // Extract repository IDs associated with this team
    const repoIds: string[] = [];
    team.projectAssignments?.forEach((tp: any) => {
      tp.project?.repositories?.forEach((pr: any) => {
        if (pr.repositoryId) repoIds.push(pr.repositoryId);
      });
    });

    // If no projects or repositories are associated with this team, return empty state immediately
    if (repoIds.length === 0) {
      return {
        teamId: team.id,
        teamName: team.name,
        overall_bus_factor: 0,
        average_gini: 0,
        total_modules_analyzed: 0,
        critical_silos_count: 0,
        vulnerable_count: 0,
        resilient_count: 0,
        has_assigned_projects: false,
        module_results: [],
        message: 'No projects assigned to this team yet. Assign a project to evaluate code ownership and bus factor.',
      };
    }

    // Query commits strictly for these assigned repositories
    const commits = await this.prisma.commit.findMany({
      where: { repositoryId: { in: repoIds } },
      take: 200,
      orderBy: { committedAt: 'desc' },
      include: {
        fileChanges: true,
      },
    });

    // Group into modules and authors
    const moduleMap = new Map<string, Map<string, { name: string; commits: number; added: number; deleted: number }>>();

    if (commits.length > 0) {
      for (const commit of commits) {
        const authorKey = commit.developerId || commit.authorEmail || commit.authorName;
        const authorName = commit.authorName;

        for (const fc of commit.fileChanges) {
          const parts = fc.filePath.split('/');
          const modName = parts.length > 1 ? parts.slice(0, 2).join('/') : 'root';

          if (!moduleMap.has(modName)) {
            moduleMap.set(modName, new Map());
          }
          const authors = moduleMap.get(modName)!;
          if (!authors.has(authorKey)) {
            authors.set(authorKey, { name: authorName, commits: 0, added: 0, deleted: 0 });
          }
          const entry = authors.get(authorKey)!;
          entry.commits += 1;
          entry.added += fc.additions;
          entry.deleted += fc.deletions;
        }
      }
    }

    // If no commits in DB for assigned repositories, return empty state without hardcoded dummy data
    if (moduleMap.size === 0) {
      return {
        teamId: team.id,
        teamName: team.name,
        overall_bus_factor: 0,
        average_gini: 0,
        total_modules_analyzed: 0,
        critical_silos_count: 0,
        vulnerable_count: 0,
        resilient_count: 0,
        has_assigned_projects: true,
        module_results: [],
        message: 'No commit activity mapped to this team assigned projects yet.',
      };
    }

    const modulesPayload: any[] = [];
    for (const [modName, authors] of moduleMap.entries()) {
        modulesPayload.push({
          module_name: modName,
          authors: Array.from(authors.entries()).map(([devId, stats]) => ({
            developer_id: devId,
            author_name: stats.name,
            commit_count: stats.commits,
            lines_added: stats.added,
            lines_deleted: stats.deleted,
          })),
        });
    }

    // Call ML service bus factor engine
    const resp = await fetch(`${this.mlServiceUrl}/api/ml/teams/bus-factor`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        repository_name: team.name,
        modules: modulesPayload,
      }),
    });

    if (!resp.ok) {
      throw new BadGatewayException(`ML Service Bus Factor Analysis failed: ${resp.statusText}`);
    }

    const busResult = await resp.json();

    // Persist snapshot in PostgreSQL
    const snapshot = await this.prisma.teamBusFactorSnapshot.create({
      data: {
        organizationId: organizationId || team.organizationId,
        teamId: team.id,
        repositoryName: team.name,
        overallBusFactor: busResult.overall_bus_factor,
        averageGini: busResult.average_gini,
        totalModules: busResult.total_modules_analyzed,
        criticalSilosCount: busResult.critical_silos_count,
        vulnerableCount: busResult.vulnerable_count,
        resilientCount: busResult.resilient_count,
        moduleDetails: busResult.module_results,
      },
    });

    return {
      snapshotId: snapshot.id,
      teamId: team.id,
      teamName: team.name,
      ...busResult,
      createdAt: snapshot.createdAt,
    };
  }

  /**
   * Retrieve historical defect predictions.
   */
  async getDefectHistory(
    organizationId?: string,
    limit = 20,
    caller?: { id: string; role?: string },
  ) {
    const where: any = organizationId ? { organizationId } : {};

    if (caller && organizationId && this.dataFilterService && typeof caller === 'object' && caller.id) {
      const scope = await this.dataFilterService.getScopedProjectAndRepoIds(
        caller.id,
        organizationId,
        caller.role as any,
      );
      if (!scope.isOrgScoped) {
        if (scope.repositoryIds.length === 0) {
          return [];
        }
        where.repositoryId = { in: scope.repositoryIds };
      }
    }

    return this.prisma.defectPrediction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Helper to verify repository belongs to the active organization and is assigned to caller's active teams if applicable.
   */
  async verifyRepositoryAccess(
    repositoryId: string,
    organizationId?: string,
    caller?: { id: string; role?: string },
  ) {
    if (!organizationId) {
      return;
    }
    if (this.dataFilterService) {
      return this.dataFilterService.verifyRepositoryAccess(repositoryId, organizationId, caller);
    }
    const repository = await this.prisma.repository.findFirst({
      where: { id: repositoryId, organizationId },
    });
    if (!repository) {
      throw new NotFoundException(`Repository ${repositoryId} not found in organization`);
    }
    return repository;
  }

  /**
   * Retrieve historical Bus Factor snapshots.
   */
  async getBusFactorSnapshots(
    teamId?: string,
    limit = 10,
    organizationId?: string,
    caller?: { id: string; role?: string },
  ) {
    if (teamId && organizationId) {
      if (caller && this.dataFilterService) {
        await this.dataFilterService.verifyTeamAccess(teamId, organizationId, caller);
      } else {
        const team = await this.prisma.team.findFirst({
          where: { id: teamId, organizationId },
        });
        if (!team) {
          throw new NotFoundException(`Team with ID ${teamId} not found in organization`);
        }
      }
    }

    const where: any = {};
    if (organizationId) {
      where.organizationId = organizationId;
    }
    if (teamId) {
      where.teamId = teamId;
    } else if (organizationId && caller && this.dataFilterService) {
      const scope = await this.dataFilterService.getScopedProjectAndRepoIds(
        caller.id,
        organizationId,
        caller.role as any,
      );
      if (!scope.isOrgScoped) {
        if (scope.teamIds.length === 0) {
          return [];
        }
        where.teamId = { in: scope.teamIds };
      }
    }

    return this.prisma.teamBusFactorSnapshot.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Retrieve repository code intelligence telemetry summary stats (true database totals).
   */
  async getRepositoryStats(
    repositoryId: string,
    organizationId?: string,
    caller?: { id: string; role?: string },
  ) {
    await this.verifyRepositoryAccess(repositoryId, organizationId, caller);
    const [
      analyzedFiles,
      criticalHotspots,
      highHotspots,
      moderateOrLowHotspots,
      jitScreenedCommits,
      totalCommits,
    ] = await Promise.all([
      this.prisma.fileASTMetric.count({ where: { repositoryId } }),
      this.prisma.fileASTMetric.count({
        where: { repositoryId, cyclomaticComplexity: { gt: 20 } },
      }),
      this.prisma.fileASTMetric.count({
        where: {
          repositoryId,
          cyclomaticComplexity: { gt: 10, lte: 20 },
        },
      }),
      this.prisma.fileASTMetric.count({
        where: { repositoryId, cyclomaticComplexity: { lte: 10 } },
      }),
      this.prisma.defectPrediction.count({
        where: { repositoryId, benchmark: 'Kamei JIT' },
      }),
      this.prisma.commit.count({ where: { repositoryId } }),
    ]);

    return {
      analyzedFiles,
      hotspots: {
        total: criticalHotspots + highHotspots,
        critical: criticalHotspots,
        high: highHotspots,
        moderateOrLow: moderateOrLowHotspots,
      },
      jitScreenedCommits,
      totalCommits,
    };
  }

  /**
   * Retrieve complexity and defect hotspots for a repository.
   */
  async getRepositoryHotspots(
    repositoryId: string,
    limit = 20,
    organizationId?: string,
    caller?: { id: string; role?: string },
  ) {
    await this.verifyRepositoryAccess(repositoryId, organizationId, caller);
    const fileMetrics = await this.prisma.fileASTMetric.findMany({
      where: { repositoryId },
      orderBy: { cyclomaticComplexity: 'desc' },
      take: limit,
    });

    const defectPredictions = await this.prisma.defectPrediction.findMany({
      where: { repositoryId, benchmark: 'NASA MDP' },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const defectMap = new Map<string, { defectProbability: number; riskLevel: string }>();
    for (const dp of defectPredictions) {
      if (dp.filePath && !defectMap.has(dp.filePath)) {
        defectMap.set(dp.filePath, {
          defectProbability: dp.defectProbability,
          riskLevel: dp.riskLevel,
        });
      }
    }

    return fileMetrics.map((fm) => {
      const defect = defectMap.get(fm.filePath);
      return {
        id: fm.id,
        repositoryId: fm.repositoryId,
        filePath: fm.filePath,
        cyclomaticComplexity: fm.cyclomaticComplexity,
        cognitiveComplexity: fm.cognitiveComplexity,
        maintainabilityIndex: fm.maintainabilityIndex,
        defectProbability: defect ? defect.defectProbability : (fm.cyclomaticComplexity > 15 ? 0.65 : 0.15),
        riskLevel: defect ? defect.riskLevel : (fm.cyclomaticComplexity > 20 ? 'CRITICAL' : fm.cyclomaticComplexity > 10 ? 'HIGH' : 'LOW'),
        updatedAt: fm.updatedAt,
      };
    });
  }

  /**
   * Retrieve recent commits with their Kamei JIT defect risk predictions.
   */
  async getRepositoryCommitsRisk(
    repositoryId: string,
    limit = 20,
    organizationId?: string,
    caller?: { id: string; role?: string },
  ) {
    await this.verifyRepositoryAccess(repositoryId, organizationId, caller);
    const predictions = await this.prisma.defectPrediction.findMany({
      where: { repositoryId, benchmark: 'Kamei JIT' },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const commitShas = predictions.map((p) => p.commitSha).filter((s): s is string => !!s);
    const commits = await this.prisma.commit.findMany({
      where: { sha: { in: commitShas } },
      select: {
        sha: true,
        message: true,
        authorName: true,
        authorEmail: true,
        developerId: true,
        linesAdded: true,
        linesDeleted: true,
        committedAt: true,
      },
    });
    const commitMap = new Map(commits.map((c) => [c.sha, c]));

    return predictions.map((p) => {
      const commit = p.commitSha ? commitMap.get(p.commitSha) : null;
      return {
        id: p.id,
        commitSha: p.commitSha,
        defectProbability: p.defectProbability,
        riskLevel: p.riskLevel,
        isDefectProne: p.isDefectProne,
        topRiskDrivers: p.topRiskDrivers,
        metricsAnalyzed: p.metricsAnalyzed,
        message: commit?.message || 'Commit details unavailable',
        authorName: commit?.authorName || 'Unknown',
        developerId: commit?.developerId || null,
        linesAdded: commit?.linesAdded || 0,
        linesDeleted: commit?.linesDeleted || 0,
        committedAt: commit?.committedAt || p.createdAt,
      };
    });
  }

  /**
   * Execute Test Impact Analysis (TIA) for PR modified files against repository DAG.
   */
  async getPullRequestTestImpact(
    repositoryId: string,
    changedFiles: string[],
    organizationId?: string,
    caller?: { id: string; role?: string },
  ) {
    await this.verifyRepositoryAccess(repositoryId, organizationId, caller);
    return this.analyzeTestImpact({
      repositoryId,
      changedFiles: changedFiles || [],
    });
  }

  /**
   * Retrieve hierarchical architectural treemap and churn vs complexity hotspot matrix for a repository.
   */
  async getRepositoryTreemap(
    repositoryId: string,
    sizeBy: 'loc' | 'churn' = 'loc',
    colorBy: 'complexity' | 'defectRisk' | 'debtCount' = 'complexity',
    organizationId?: string,
    caller?: { id: string; role?: string },
  ): Promise<RepositoryTreemapResponseDto> {
    await this.verifyRepositoryAccess(repositoryId, organizationId, caller);
    const [fileMetrics, openDebt, defectPredictions, fileStats, repoHotspotsCount, commitLines] =
      await Promise.all([
        this.prisma.fileASTMetric.findMany({
          where: { repositoryId },
          orderBy: { cyclomaticComplexity: 'desc' },
          take: 200,
        }),
        this.prisma.debtItem.findMany({
          where: { repositoryId, isResolved: false },
          select: { filePath: true },
        }),
        this.prisma.defectPrediction.findMany({
          where: { repositoryId, benchmark: 'NASA MDP' },
          orderBy: { createdAt: 'desc' },
          take: 200,
        }),
        this.prisma.fileASTMetric.aggregate({
          where: { repositoryId },
          _count: { id: true },
          _avg: { cyclomaticComplexity: true },
        }),
        this.prisma.fileASTMetric.count({
          where: { repositoryId, cyclomaticComplexity: { gt: 10 } },
        }),
        this.prisma.commit.aggregate({
          where: { repositoryId },
          _sum: { linesAdded: true, linesDeleted: true },
        }),
      ]);

    const debtMap = new Map<string, number>();
    for (const d of openDebt) {
      debtMap.set(d.filePath, (debtMap.get(d.filePath) || 0) + 1);
    }

    const defectMap = new Map<string, { defectProbability: number; riskLevel: string }>();
    for (const dp of defectPredictions) {
      if (dp.filePath && !defectMap.has(dp.filePath)) {
        defectMap.set(dp.filePath, {
          defectProbability: dp.defectProbability,
          riskLevel: dp.riskLevel,
        });
      }
    }

    const targetFilePaths = fileMetrics.map((fm) => fm.filePath);
    const fileChanges = await this.prisma.fileChange.findMany({
      where: {
        commit: { repositoryId },
        filePath: { in: targetFilePaths },
      },
      select: {
        filePath: true,
        additions: true,
        deletions: true,
      },
    });

    const fileChurnMap = new Map<string, { churn: number; netLines: number }>();
    for (const fc of fileChanges || []) {
      const existing = fileChurnMap.get(fc.filePath) || { churn: 0, netLines: 0 };
      existing.churn += 1;
      existing.netLines += (fc.additions || 0) - (fc.deletions || 0);
      fileChurnMap.set(fc.filePath, existing);
    }

    let filesToProcess = fileMetrics.map((fm) => {
      const defect = defectMap.get(fm.filePath);
      const gitData = fileChurnMap.get(fm.filePath);
      const estLoc = Math.max(35, fm.cyclomaticComplexity * 20 + fm.cognitiveComplexity * 10);
      const realLoc = gitData && gitData.netLines > 20 ? gitData.netLines : estLoc;
      const realChurn =
        gitData && gitData.churn > 0
          ? gitData.churn
          : Math.max(1, (fm.cyclomaticComplexity % 15) + 1);

      return {
        filePath: fm.filePath,
        loc: realLoc,
        cyclomaticComplexity: fm.cyclomaticComplexity,
        cognitiveComplexity: fm.cognitiveComplexity,
        defectProbability: defect
          ? defect.defectProbability
          : fm.cyclomaticComplexity > 15
          ? 0.68
          : fm.cyclomaticComplexity > 8
          ? 0.35
          : 0.12,
        riskLevel: (defect
          ? defect.riskLevel
          : fm.cyclomaticComplexity > 20
          ? 'CRITICAL'
          : fm.cyclomaticComplexity > 10
          ? 'HIGH'
          : fm.cyclomaticComplexity > 5
          ? 'MODERATE'
          : 'LOW') as 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW',
        debtCount: debtMap.get(fm.filePath) || 0,
        churnCount: realChurn,
      };
    });

    const isPartialData = filesToProcess.length > 0 && filesToProcess.length < 3;

    // Build hierarchical tree
    interface InternalDirNode {
      name: string;
      path: string;
      type: 'directory';
      children: Map<string, InternalDirNode | TreemapNodeDto>;
    }

    const rootDir: InternalDirNode = {
      name: 'root',
      path: '',
      type: 'directory',
      children: new Map(),
    };

    for (const f of filesToProcess) {
      const parts = f.filePath.split('/');
      let current = rootDir;

      for (let i = 0; i < parts.length - 1; i++) {
        const seg = parts[i];
        if (!current.children.has(seg)) {
          const dirPath = parts.slice(0, i + 1).join('/');
          const newDir: InternalDirNode = {
            name: seg,
            path: dirPath,
            type: 'directory',
            children: new Map(),
          };
          current.children.set(seg, newDir);
        }
        current = current.children.get(seg) as InternalDirNode;
      }

      const fileName = parts[parts.length - 1];
      const leafNode: TreemapNodeDto = {
        name: fileName,
        path: f.filePath,
        type: 'file',
        loc: f.loc,
        cyclomaticComplexity: f.cyclomaticComplexity,
        cognitiveComplexity: f.cognitiveComplexity,
        defectProbability: f.defectProbability,
        debtCount: f.debtCount,
        churnCount: f.churnCount,
        riskLevel: f.riskLevel,
      };
      current.children.set(fileName, leafNode);
    }

    // Recursive post-order conversion and rollup
    const convertNode = (node: InternalDirNode | TreemapNodeDto): TreemapNodeDto => {
      if (node.type === 'file') {
        return node as TreemapNodeDto;
      }

      const rawChildren = Array.from((node as InternalDirNode).children.values()).map(convertNode);
      const totalLoc = rawChildren.reduce((acc, c) => acc + c.loc, 0);
      const totalChurn = rawChildren.reduce((acc, c) => acc + c.churnCount, 0);
      const totalDebt = rawChildren.reduce((acc, c) => acc + c.debtCount, 0);

      const weightedCC = totalLoc > 0
        ? Number((rawChildren.reduce((acc, c) => acc + c.cyclomaticComplexity * c.loc, 0) / totalLoc).toFixed(1))
        : 0;

      const weightedCog = totalLoc > 0
        ? Number((rawChildren.reduce((acc, c) => acc + c.cognitiveComplexity * c.loc, 0) / totalLoc).toFixed(1))
        : 0;

      const maxDefect = rawChildren.length > 0
        ? Number(Math.max(...rawChildren.map((c) => c.defectProbability)).toFixed(2))
        : 0;

      let riskLevel: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW' = 'LOW';
      if (weightedCC >= 18 || maxDefect >= 0.65) riskLevel = 'CRITICAL';
      else if (weightedCC >= 12 || maxDefect >= 0.45) riskLevel = 'HIGH';
      else if (weightedCC >= 6 || maxDefect >= 0.25) riskLevel = 'MODERATE';

      return {
        name: node.name,
        path: node.path,
        type: 'directory',
        loc: totalLoc,
        cyclomaticComplexity: weightedCC,
        cognitiveComplexity: weightedCog,
        defectProbability: maxDefect,
        debtCount: totalDebt,
        churnCount: totalChurn,
        riskLevel,
        children: rawChildren,
      };
    };

    const rootDto = convertNode(rootDir);

    // Compute Hotspot Quadrants
    const churns = filesToProcess.map((f) => f.churnCount).sort((a, b) => a - b);
    const medianChurn = churns[Math.floor(churns.length / 2)] || 15;
    const complexityThreshold = 12;

    const quadrantFiles: QuadrantFileInfo[] = filesToProcess.map((f) => {
      let quadrant: 'DANGER_ZONE' | 'STABLE_COMPLEX' | 'ACTIVE_SIMPLE' | 'HEALTHY';
      if (f.churnCount >= medianChurn && f.cyclomaticComplexity >= complexityThreshold) {
        quadrant = 'DANGER_ZONE';
      } else if (f.churnCount < medianChurn && f.cyclomaticComplexity >= complexityThreshold) {
        quadrant = 'STABLE_COMPLEX';
      } else if (f.churnCount >= medianChurn && f.cyclomaticComplexity < complexityThreshold) {
        quadrant = 'ACTIVE_SIMPLE';
      } else {
        quadrant = 'HEALTHY';
      }

      return {
        filePath: f.filePath,
        loc: f.loc,
        cyclomaticComplexity: f.cyclomaticComplexity,
        churnCount: f.churnCount,
        debtCount: f.debtCount,
        defectProbability: f.defectProbability,
        riskLevel: f.riskLevel,
        quadrant,
      };
    });

    const quadrantCounts = {
      dangerZone: quadrantFiles.filter((q) => q.quadrant === 'DANGER_ZONE').length,
      stableComplex: quadrantFiles.filter((q) => q.quadrant === 'STABLE_COMPLEX').length,
      activeSimple: quadrantFiles.filter((q) => q.quadrant === 'ACTIVE_SIMPLE').length,
      healthy: quadrantFiles.filter((q) => q.quadrant === 'HEALTHY').length,
    };

    const totalLoc = rootDto.loc;
    const averageComplexity = filesToProcess.length > 0
      ? Number((filesToProcess.reduce((acc, f) => acc + f.cyclomaticComplexity, 0) / filesToProcess.length).toFixed(1))
      : 0;

    const repoTotalFiles = fileStats?._count?.id ?? filesToProcess.length;
    const repoAvgComplexity = fileStats?._avg?.cyclomaticComplexity
      ? Number(fileStats._avg.cyclomaticComplexity.toFixed(1))
      : averageComplexity;
    const netCommitLoc = Math.max(
      0,
      (commitLines?._sum?.linesAdded || 0) - (commitLines?._sum?.linesDeleted || 0),
    );
    const repoTotalLoc = netCommitLoc > 0 ? netCommitLoc : rootDto.loc;

    return {
      repositoryId,
      totalFiles: filesToProcess.length,
      totalLoc,
      averageComplexity,
      visualizedFiles: filesToProcess.length,
      repoStats: {
        totalFiles: repoTotalFiles,
        totalLoc: repoTotalLoc,
        averageComplexity: repoAvgComplexity,
        totalHotspots: repoHotspotsCount,
      },
      root: rootDto,
      quadrantCounts,
      quadrantFiles,
      isPartialData,
    };
  }
}

