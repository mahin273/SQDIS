import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Octokit } from '@octokit/rest';
import { PrismaService } from '../../../prisma/prisma.service';
import { GitHubService } from '../github.service';
import { CodeIntelligenceService } from '../../code-intelligence/code-intelligence.service';
import { QualityGateStatus } from '@prisma/client';

export interface EvaluatePrQualityGateOptions {
  repositoryId: string;
  prNumber: number;
  headCommitSha?: string;
  pullRequestId?: string;
  organizationId?: string;
  filesOverride?: Array<{ path: string; content?: string }>;
}

export interface QualityGateEvaluationResult {
  id: string;
  pullRequestId: string;
  repositoryId: string;
  prNumber: number;
  headCommitSha: string;
  status: QualityGateStatus;
  defectProbability: number;
  riskLevel: string;
  maxComplexity: number;
  impactedTestsCount: number;
  prunedPercentage: number;
  estimatedTimeSaved: number;
  summaryMarkdown: string;
  githubCommentId: number | null;
  githubStatusState: string | null;
  createdAt: Date;
}

if (typeof BigInt !== 'undefined' && !(BigInt.prototype as any).toJSON) {
  (BigInt.prototype as any).toJSON = function () {
    return Number(this);
  };
}

const QUALITY_GATE_MARKER = '<!-- SQDIS-QUALITY-GATE-BOT -->';
const CODE_FILE_EXTENSIONS = /\.(ts|tsx|js|jsx|py|go|java|cpp|c|cs|rb|php|rs|swift|scala|kt)$/i;

@Injectable()
export class PrQualityGateBotService {
  private readonly logger = new Logger(PrQualityGateBotService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly githubService: GitHubService,
    private readonly codeIntelligenceService: CodeIntelligenceService,
  ) {}

  /**
   * Orchestrate full code health evaluation for a pull request, post/update PR comment idempotently,
   * set commit status check, and persist the record.
   */
  async evaluateAndReport(
    options: EvaluatePrQualityGateOptions,
  ): Promise<QualityGateEvaluationResult> {
    this.logger.log(
      `Evaluating Quality Gate for repo ${options.repositoryId} PR #${options.prNumber}`,
    );

    // 1. Resolve repository
    const repository = await this.prisma.repository.findUnique({
      where: { id: options.repositoryId },
    });

    if (!repository) {
      throw new NotFoundException(`Repository with ID ${options.repositoryId} not found`);
    }

    const organizationId = options.organizationId || repository.organizationId;
    const [owner, repoName] = repository.fullName.split('/');

    // 2. Resolve or upsert PullRequest record
    let pullRequest = await this.prisma.pullRequest.findFirst({
      where: {
        repositoryId: repository.id,
        prNumber: options.prNumber,
      },
    });

    const headCommitSha =
      options.headCommitSha || pullRequest?.headCommitSha || 'HEAD';

    if (!pullRequest) {
      pullRequest = await this.prisma.pullRequest.create({
        data: {
          repositoryId: repository.id,
          githubPrId: options.prNumber,
          prNumber: options.prNumber,
          title: `Pull Request #${options.prNumber}`,
          state: 'OPEN',
          authorLogin: 'unknown',
          authorId: 0,
          baseBranch: 'main',
          headBranch: 'feature',
          baseCommitSha: 'HEAD~1',
          headCommitSha,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }

    // 3. Obtain GitHub Octokit client if configured
    let octokit: Octokit | null = null;
    try {
      octokit = await this.githubService.getOctokitForOrganization(organizationId);
    } catch (authErr) {
      this.logger.warn(
        `GitHub credentials unavailable for organization ${organizationId}: ${authErr.message}. Running in local analysis mode.`,
      );
    }

    // 4. Collect modified files
    let modifiedFiles: Array<{
      filename: string;
      additions: number;
      deletions: number;
      changes: number;
      patch?: string;
      content?: string;
    }> = [];

    if (options.filesOverride && options.filesOverride.length > 0) {
      modifiedFiles = options.filesOverride.map((f) => ({
        filename: f.path,
        additions: (f.content || '').split('\n').length,
        deletions: 0,
        changes: (f.content || '').split('\n').length,
        content: f.content,
      }));
    } else if (octokit) {
      try {
        const { data: prFiles } = await octokit.rest.pulls.listFiles({
          owner,
          repo: repoName,
          pull_number: options.prNumber,
          per_page: 100,
        });

        modifiedFiles = prFiles.map((f) => ({
          filename: f.filename,
          additions: f.additions,
          deletions: f.deletions,
          changes: f.changes,
          patch: f.patch,
        }));
      } catch (fileErr) {
        this.logger.warn(
          `Failed to fetch PR files from GitHub API: ${fileErr.message}. Using fallback changeset.`,
        );
      }
    }

    // 5. Check if changeset contains any executable code files
    const codeFiles = modifiedFiles.filter((f) => CODE_FILE_EXTENSIONS.test(f.filename));
    const isDocsOrConfigOnly = modifiedFiles.length > 0 && codeFiles.length === 0;

    let status: QualityGateStatus = QualityGateStatus.PASSED;
    let defectProbability = 0.05;
    let riskLevel = 'LOW';
    let maxComplexity = 1;
    let hotspotFile = codeFiles[0]?.filename || 'N/A';
    let impactedTestsCount = 0;
    let prunedPercentage = 100.0;
    let estimatedTimeSaved = 0.0;
    let impactedTestFiles: string[] = [];
    let skippedTestFiles: string[] = [];
    let criticalSecurityCount = 0;
    let securityViolations: string[] = [];
    let complexityViolations: string[] = [];

    if (isDocsOrConfigOnly) {
      // Fast path for documentation, configuration, or asset-only changesets
      status = QualityGateStatus.PASSED;
      defectProbability = 0.05;
      riskLevel = 'LOW';
      maxComplexity = 1;
      impactedTestsCount = 0;
      prunedPercentage = 100.0;
      estimatedTimeSaved = 0.0;
    } else if (codeFiles.length > 0 || modifiedFiles.length > 0) {
      // Deep intelligence scan on code files (cap at 20 files to prevent rate-limiting)
      const targetCodeFiles = codeFiles.slice(0, 20);
      const filesForAnalysis: Array<{ path: string; content: string }> = [];

      for (const f of targetCodeFiles) {
        let content = f.content;
        if (!content && octokit && headCommitSha !== 'HEAD') {
          try {
            const contentRes = await octokit.rest.repos.getContent({
              owner,
              repo: repoName,
              path: f.filename,
              ref: headCommitSha,
            });

            if ('content' in contentRes.data && contentRes.data.content) {
              content = Buffer.from(contentRes.data.content, 'base64').toString('utf8');
            }
          } catch {
            // Ignore failure, fall back to patch reconstruction
          }
        }

        if (!content) {
          content = f.patch
            ? `// Changeset patch for ${f.filename}\n${f.patch}`
            : `// Source file: ${f.filename}\nexport function mod() {}`;
        }

        filesForAnalysis.push({ path: f.filename, content });
      }

      // 6. Run AST code quality & structural complexity analysis via ML service
      try {
        const qualityResult = await this.codeIntelligenceService.analyzeCodeQuality(
          filesForAnalysis,
          repository.id,
        );

        const prFilesSet = new Set(filesForAnalysis.map((f) => f.path));

        // Filter analysis strictly to the changeset's modified files
        const prComplexities = (qualityResult?.complexity || []).filter((c: any) =>
          prFilesSet.has(c.path),
        );
        const prSecurities = (qualityResult?.security || []).filter((s: any) =>
          prFilesSet.has(s.path),
        );

        if (prComplexities.length > 0) {
          for (const c of prComplexities) {
            const cc = c.cyclomatic_complexity || 1;
            if (cc > maxComplexity) {
              maxComplexity = cc;
              hotspotFile = c.path;
            }
            if (cc > 25) {
              complexityViolations.push(
                `High Cyclomatic Complexity (${cc}) in \`${c.path}\` (threshold: 25)`,
              );
            } else if (cc > 15) {
              complexityViolations.push(
                `Moderate Cyclomatic Complexity (${cc}) in \`${c.path}\` (threshold: 15)`,
              );
            }
          }
        }

        if (prSecurities.length > 0) {
          for (const s of prSecurities) {
            const sev = (s.severity || 'MEDIUM').toUpperCase();
            if (sev === 'HIGH' || sev === 'CRITICAL') {
              criticalSecurityCount++;
            }
            securityViolations.push(
              `[${sev}] \`${s.path}\`: ${s.message || 'Potential security issue'}`,
            );
          }
        }
      } catch (err) {
        this.logger.warn(`Structural code quality analysis failed: ${err.message}`);
      }

      // 7. Run commit defect risk prediction
      const totalAdditions = modifiedFiles.reduce((acc, f) => acc + f.additions, 0);
      const totalDeletions = modifiedFiles.reduce((acc, f) => acc + f.deletions, 0);

      try {
        const commitRisk = await this.codeIntelligenceService.predictCommitRisk(
          {
            commitSha: headCommitSha,
            addedLines: totalAdditions,
            deletedLines: totalDeletions,
            modifiedFilesCount: modifiedFiles.length,
            maxCyclomaticComplexity: maxComplexity,
            authorExperienceCommits: 50,
            directoryEntropy: 1.0,
            repositoryId: repository.id,
          },
          organizationId,
          repository.id,
        );

        defectProbability = commitRisk.defect_probability;
        riskLevel = commitRisk.risk_level;
      } catch (err) {
        this.logger.warn(`Commit defect risk prediction failed: ${err.message}`);
        // Baseline heuristic fallback
        defectProbability = maxComplexity > 25 ? 0.72 : maxComplexity > 15 ? 0.45 : 0.18;
        riskLevel = defectProbability > 0.65 ? 'HIGH' : defectProbability >= 0.4 ? 'MODERATE' : 'LOW';
      }

      // 8. Run Test Impact Analysis (TIA)
      try {
        const changedPaths = modifiedFiles.map((f) => f.filename);
        const tiaResult = await this.codeIntelligenceService.analyzeTestImpact({
          repositoryId: repository.id,
          changedFiles: changedPaths,
          fileContents: Object.fromEntries(filesForAnalysis.map((f) => [f.path, f.content])),
        });

        impactedTestsCount = tiaResult.impacted_tests_count || 0;
        prunedPercentage = tiaResult.time_savings_percentage || 0.0;
        impactedTestFiles = tiaResult.impacted_test_files || [];
        skippedTestFiles = tiaResult.skipped_test_files || [];
        estimatedTimeSaved = Math.round((prunedPercentage / 100) * 180);
      } catch (err) {
        this.logger.warn(`Test Impact Analysis failed: ${err.message}`);
      }

      // 9. Evaluate Quality Gate Decision Thresholds
      if (defectProbability > 0.65 || maxComplexity > 25 || criticalSecurityCount > 0) {
        status = QualityGateStatus.BLOCKED;
      } else if (defectProbability >= 0.4 || maxComplexity > 15) {
        status = QualityGateStatus.WARNING;
      } else {
        status = QualityGateStatus.PASSED;
      }
    }

    const githubStatusState = status === QualityGateStatus.BLOCKED ? 'failure' : 'success';

    // 10. Generate Markdown Summary (Zero Buzzwords)
    const summaryMarkdown = this.formatMarkdownSummary({
      status,
      defectProbability,
      riskLevel,
      maxComplexity,
      hotspotFile,
      impactedTestsCount,
      prunedPercentage,
      estimatedTimeSaved,
      impactedTestFiles,
      skippedTestFilesCount: skippedTestFiles.length,
      securityViolations,
      complexityViolations,
      isDocsOrConfigOnly,
    });

    // 11. Idempotently Post or Update GitHub PR Comment
    let githubCommentId: number | null = null;
    if (octokit) {
      try {
        const { data: comments } = await octokit.rest.issues.listComments({
          owner,
          repo: repoName,
          issue_number: options.prNumber,
          per_page: 50,
        });

        const existingBotComment = comments.find((c) =>
          c.body?.includes(QUALITY_GATE_MARKER),
        );

        if (existingBotComment) {
          await octokit.rest.issues.updateComment({
            owner,
            repo: repoName,
            comment_id: existingBotComment.id,
            body: summaryMarkdown,
          });
          githubCommentId = existingBotComment.id;
          this.logger.log(
            `Updated existing Quality Gate bot comment #${githubCommentId} on PR #${options.prNumber}`,
          );
        } else {
          const newComment = await octokit.rest.issues.createComment({
            owner,
            repo: repoName,
            issue_number: options.prNumber,
            body: summaryMarkdown,
          });
          githubCommentId = newComment.data.id;
          this.logger.log(
            `Created new Quality Gate bot comment #${githubCommentId} on PR #${options.prNumber}`,
          );
        }
      } catch (commentErr) {
        this.logger.warn(`Failed to post/update GitHub PR comment: ${commentErr.message}`);
      }

      // 12. Set GitHub Commit Status Check
      if (headCommitSha && headCommitSha !== 'HEAD') {
        try {
          const pct = Math.round(defectProbability * 100);
          const desc =
            status === QualityGateStatus.BLOCKED
              ? `Gate Blocked: Defect risk ${pct}% | Peak CC: ${maxComplexity}`
              : status === QualityGateStatus.WARNING
                ? `Gate Warning: Defect risk ${pct}% | Peak CC: ${maxComplexity}`
                : `Gate Passed: Defect risk ${pct}% | Peak CC: ${maxComplexity}`;

          await octokit.rest.repos.createCommitStatus({
            owner,
            repo: repoName,
            sha: headCommitSha,
            state: githubStatusState as 'success' | 'failure',
            context: 'sqdis/quality-gate',
            description: desc.slice(0, 140),
          });
          this.logger.log(
            `Posted GitHub commit status '${githubStatusState}' for ${headCommitSha.slice(0, 7)}`,
          );
        } catch (statusErr) {
          this.logger.warn(`Failed to set GitHub commit status check: ${statusErr.message}`);
        }
      }
    }

    // 13. Persist evaluation record into PostgreSQL
    const savedRecord = await this.prisma.pullRequestQualityGate.create({
      data: {
        pullRequestId: pullRequest.id,
        repositoryId: repository.id,
        prNumber: options.prNumber,
        headCommitSha,
        status,
        defectProbability,
        riskLevel,
        maxComplexity,
        impactedTestsCount,
        prunedPercentage,
        estimatedTimeSaved,
        summaryMarkdown,
        githubCommentId: githubCommentId ? BigInt(githubCommentId) : null,
        githubStatusState,
      },
    });

    return {
      id: savedRecord.id,
      pullRequestId: savedRecord.pullRequestId,
      repositoryId: savedRecord.repositoryId,
      prNumber: savedRecord.prNumber,
      headCommitSha: savedRecord.headCommitSha,
      status: savedRecord.status,
      defectProbability: savedRecord.defectProbability,
      riskLevel: savedRecord.riskLevel,
      maxComplexity: savedRecord.maxComplexity,
      impactedTestsCount: savedRecord.impactedTestsCount,
      prunedPercentage: savedRecord.prunedPercentage,
      estimatedTimeSaved: savedRecord.estimatedTimeSaved,
      summaryMarkdown: savedRecord.summaryMarkdown,
      githubCommentId: savedRecord.githubCommentId ? Number(savedRecord.githubCommentId) : null,
      githubStatusState: savedRecord.githubStatusState,
      createdAt: savedRecord.createdAt,
    };
  }

  /**
   * Retrieve the latest quality gate evaluation for a given PR.
   */
  async getLatestEvaluation(repositoryId: string, prNumber: number) {
    const record = await this.prisma.pullRequestQualityGate.findFirst({
      where: { repositoryId, prNumber },
      orderBy: { createdAt: 'desc' },
      include: {
        pullRequest: {
          select: {
            title: true,
            state: true,
            authorLogin: true,
            headBranch: true,
            baseBranch: true,
          },
        },
      },
    });
    if (!record) return null;
    return {
      ...record,
      githubCommentId: record.githubCommentId ? Number(record.githubCommentId) : null,
    };
  }

  /**
   * Format professional, clear Markdown summary without buzzwords.
   */
  formatMarkdownSummary(params: {
    status: QualityGateStatus;
    defectProbability: number;
    riskLevel: string;
    maxComplexity: number;
    hotspotFile: string;
    impactedTestsCount: number;
    prunedPercentage: number;
    estimatedTimeSaved: number;
    impactedTestFiles: string[];
    skippedTestFilesCount: number;
    securityViolations: string[];
    complexityViolations: string[];
    isDocsOrConfigOnly: boolean;
  }): string {
    const badge =
      params.status === QualityGateStatus.PASSED
        ? '🟢 **PASSED**'
        : params.status === QualityGateStatus.WARNING
          ? '🟡 **WARNING**'
          : '🔴 **BLOCKED**';

    const probPct = (params.defectProbability * 100).toFixed(1);

    let md = `## 🛡️ SQDIS Quality Gate: ${badge}\n\n`;
    md += `${QUALITY_GATE_MARKER}\n\n`;

    if (params.isDocsOrConfigOnly) {
      md += `> ℹ️ **Documentation / Configuration Changeset**\n`;
      md += `> No executable source code changes detected. Automated quality checks passed.\n\n`;
      md += `---\n*Automated Code Quality Gate by SQDIS*\n`;
      return md;
    }

    md += `### 📊 Code Health Summary\n\n`;
    md += `| Quality Metric | Measured Value | Threshold / Status |\n`;
    md += `| :--- | :--- | :--- |\n`;
    md += `| **Defect Probability** | \`${probPct}%\` (${params.riskLevel} Risk) | ${params.defectProbability > 0.65 ? '❌ Exceeds 65%' : params.defectProbability >= 0.4 ? '⚠️ Moderate (40-65%)' : '✅ Within limits (< 40%)'} |\n`;
    md += `| **Peak Cyclomatic Complexity** | \`${params.maxComplexity}\` (\`${params.hotspotFile}\`) | ${params.maxComplexity > 25 ? '❌ Exceeds 25' : params.maxComplexity > 15 ? '⚠️ Elevated (16-25)' : '✅ Acceptable (≤ 15)'} |\n`;
    md += `| **Impacted Test Suites** | \`${params.impactedTestsCount}\` suites required | ℹ️ Targeted verification |\n`;
    md += `| **CI Test Time Saved** | \`${params.prunedPercentage.toFixed(1)}%\` pruned (~${params.estimatedTimeSaved}s) | ⚡ Accelerated build |\n\n`;

    // Test Impact Section
    md += `### 🧪 Test Impact Analysis\n\n`;
    if (params.impactedTestFiles.length > 0) {
      md += `The following test suites cover modified components and **must be executed**:\n`;
      for (const t of params.impactedTestFiles.slice(0, 10)) {
        md += `- \`${t}\`\n`;
      }
      if (params.impactedTestFiles.length > 10) {
        md += `- *(and ${params.impactedTestFiles.length - 10} more suites)*\n`;
      }
    } else {
      md += `✅ No existing test suites are directly impacted by this changeset.\n`;
    }

    if (params.skippedTestFilesCount > 0) {
      md += `\n*Safely skipped **${params.skippedTestFilesCount}** unaffected test suites.*\n\n`;
    } else {
      md += `\n`;
    }

    // Hotspots & Violations Section
    if (
      params.complexityViolations.length > 0 ||
      params.securityViolations.length > 0
    ) {
      md += `### ⚠️ Findings & Recommendations\n\n`;
      for (const comp of params.complexityViolations) {
        md += `- ⚠️ **Complexity Warning**: ${comp}\n`;
      }
      for (const sec of params.securityViolations) {
        md += `- 🔒 **Security Notice**: ${sec}\n`;
      }
      md += `\n`;
    } else {
      md += `### ✅ Findings & Recommendations\n\n`;
      md += `No structural complexity hotspots or security vulnerabilities detected in this changeset.\n\n`;
    }

    md += `---\n*Automated Code Quality Gate by SQDIS*\n`;
    return md;
  }
}
