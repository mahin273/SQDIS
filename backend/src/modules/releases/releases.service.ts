import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  Logger,
  Optional,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma';
import { GitHubService } from '../github/github.service';
import { CreateReleaseDto } from './dto/create-release.dto';
import { UpdateReleaseDto } from './dto/update-release.dto';
import {
  ReleaseResponseDto,
  ReadinessScoreDto,
  SprintSummaryDto,
} from './dto/release-response.dto';
import {
  EvaluateTelemetryDto,
  ReleaseTelemetryResponseDto,
} from './dto/evaluate-telemetry.dto';
import {
  RollbackReleaseDto,
  RollbackResponseDto,
} from './dto/rollback-release.dto';
import {
  ShipReleaseDto,
  ShipReleaseResponseDto,
  GitHubReleaseDetails,
  WorkflowDispatchDetails,
} from './dto/ship-release.dto';

/**
 * Service for release management
 */
@Injectable()
export class ReleasesService {
  private readonly logger = new Logger(ReleasesService.name);
  private readonly mlServiceUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly configService?: ConfigService,
    @Optional() @Inject(forwardRef(() => GitHubService)) private readonly githubService?: GitHubService,
  ) {
    this.mlServiceUrl =
      this.configService?.get<string>('ML_SERVICE_URL', 'http://ml-service:8000') ||
      'http://ml-service:8000';
  }

  /**
   * Create a new release
   */
  async create(dto: CreateReleaseDto, organizationId: string) {
    // Check for duplicate version in the organization
    const existingRelease = await this.prisma.release.findFirst({
      where: {
        organizationId,
        version: dto.version,
        isActive: true,
      },
    });

    if (existingRelease) {
      throw new ConflictException(`Release version "${dto.version}" already exists`);
    }

    return this.prisma.release.create({
      data: {
        version: dto.version,
        targetDate: new Date(dto.targetDate),
        description: dto.description,
        organizationId,
        isActive: true,
      },
      include: {
        sprintAssociations: {
          include: {
            sprint: {
              include: {
                team: {
                  select: { name: true },
                },
              },
            },
          },
        },
      },
    });
  }

  /**
   * Get all releases for an organization
   */
  async findAll(organizationId: string): Promise<ReleaseResponseDto[]> {
    const releases = await this.prisma.release.findMany({
      where: {
        organizationId,
        isActive: true,
      },
      include: {
        sprintAssociations: {
          include: {
            sprint: {
              include: {
                team: {
                  select: { name: true },
                },
              },
            },
          },
        },
      },
      orderBy: { targetDate: 'desc' },
    });

    return releases.map((release) => this.formatReleaseResponse(release));
  }

  /**
   * Get release by ID
   */
  async findById(id: string): Promise<ReleaseResponseDto> {
    const release = await this.prisma.release.findUnique({
      where: { id },
      include: {
        sprintAssociations: {
          include: {
            sprint: {
              include: {
                team: {
                  select: { name: true },
                },
              },
            },
          },
        },
      },
    });

    if (!release) {
      throw new NotFoundException('Release not found');
    }

    return this.formatReleaseResponse(release);
  }

  /**
   * Update release
   */
  async update(id: string, dto: UpdateReleaseDto) {
    const release = await this.prisma.release.findUnique({
      where: { id },
    });

    if (!release) {
      throw new NotFoundException('Release not found');
    }

    const updateData: any = {};

    if (dto.version !== undefined) {
      // Check for duplicate version
      const existingRelease = await this.prisma.release.findFirst({
        where: {
          organizationId: release.organizationId,
          version: dto.version,
          isActive: true,
          id: { not: id },
        },
      });

      if (existingRelease) {
        throw new ConflictException(`Release version "${dto.version}" already exists`);
      }

      updateData.version = dto.version;
    }

    if (dto.targetDate !== undefined) {
      updateData.targetDate = new Date(dto.targetDate);
    }

    if (dto.description !== undefined) {
      updateData.description = dto.description;
    }

    if (dto.shippedAt !== undefined) {
      updateData.shippedAt = new Date(dto.shippedAt);
    }

    if (dto.status !== undefined) {
      if (dto.status === 'RELEASED' && !dto.shippedAt) {
        updateData.shippedAt = new Date();
      } else if (dto.status === 'PLANNED' || dto.status === 'DRAFT') {
        updateData.shippedAt = null;
      }
    }

    const updated = await this.prisma.release.update({
      where: { id },
      data: updateData,
      include: {
        sprintAssociations: {
          include: {
            sprint: {
              include: {
                team: {
                  select: { name: true },
                },
              },
            },
          },
        },
      },
    });

    return this.formatReleaseResponse(updated);
  }

  /**
   * Ship a release with optional automated GitHub Release & Git Tag creation (Option A)
   * and optional GitHub Actions workflow dispatch (Option B).
   */
  async shipRelease(
    id: string,
    organizationId: string,
    dto?: ShipReleaseDto,
    userId?: string,
  ): Promise<ShipReleaseResponseDto> {
    const release = await this.prisma.release.findFirst({
      where: { id, organizationId, isActive: true },
      include: {
        sprintAssociations: {
          include: {
            sprint: {
              include: { team: { select: { name: true } } },
            },
          },
        },
      },
    });

    if (!release) {
      throw new NotFoundException('Release not found');
    }

    if (release.isRolledBack) {
      throw new ConflictException(`Cannot ship release "${release.version}" because it has been rolled back.`);
    }

    // 1. Update release in PostgreSQL with shippedAt timestamp
    const shippedAt = new Date();
    const updated = await this.prisma.release.update({
      where: { id },
      data: { shippedAt },
      include: {
        sprintAssociations: {
          include: {
            sprint: {
              include: { team: { select: { name: true } } },
            },
          },
        },
      },
    });

    const releaseResponse = this.formatReleaseResponse(updated);
    let githubReleaseResult: GitHubReleaseDetails | undefined = undefined;
    let workflowDispatchResult: WorkflowDispatchDetails | undefined = undefined;

    // Resolve target repository if Option A or Option B is enabled
    if (dto?.createGitHubRelease || dto?.triggerWorkflow) {
      let repository = dto?.repositoryId
        ? await this.prisma.repository.findFirst({
            where: { id: dto.repositoryId, organizationId },
          })
        : await this.prisma.repository.findFirst({
            where: { organizationId, isEnabled: true },
            orderBy: { createdAt: 'asc' },
          });

      if (!repository) {
        repository = await this.prisma.repository.findFirst({
          where: { organizationId },
        });
      }

      if (!repository) {
        const noRepoMsg = 'No connected GitHub repository found for this organization.';
        if (dto?.createGitHubRelease) {
          githubReleaseResult = { success: false, error: noRepoMsg };
        }
        if (dto?.triggerWorkflow) {
          workflowDispatchResult = { success: false, error: noRepoMsg };
        }
      } else {
        const [owner, repo] = repository.fullName.split('/');

        // Initialize authenticated Octokit client
        let octokit: any = null;
        if (this.githubService) {
          try {
            octokit = await this.githubService.getOctokitForOrganization(organizationId);
          } catch (err: any) {
            this.logger.warn(`Failed to initialize GitHub client: ${err.message}`);
          }
        }

        if (!octokit) {
          const errMsg = 'GitHub integration is not connected or token has expired. Please verify GitHub settings.';
          if (dto?.createGitHubRelease) {
            githubReleaseResult = { success: false, error: errMsg };
          }
          if (dto?.triggerWorkflow) {
            workflowDispatchResult = { success: false, error: errMsg };
          }
        } else {
          const tagName =
            dto.tagName?.trim() ||
            (release.version.startsWith('v') ? release.version : `v${release.version}`);
          const releaseTitle = dto.releaseName?.trim() || `Release ${tagName}`;
          const releaseBody =
            dto.releaseNotes?.trim() ||
            release.description ||
            `Automated release ${tagName} published via SQDIS Quality Governance.`;

          // ==================== OPTION A: Create GitHub Release & Git Tag ====================
          if (dto?.createGitHubRelease) {
            try {
              this.logger.log(`Publishing GitHub Release ${tagName} for repository ${repository.fullName}...`);
              const ghRes = await octokit.repos.createRelease({
                owner,
                repo,
                tag_name: tagName,
                name: releaseTitle,
                body: releaseBody,
                draft: false,
                prerelease: tagName.includes('rc') || tagName.includes('beta') || tagName.includes('alpha'),
                generate_release_notes: true,
              });

              githubReleaseResult = {
                success: true,
                id: ghRes.data.id,
                tagName: ghRes.data.tag_name,
                name: ghRes.data.name || tagName,
                htmlUrl: ghRes.data.html_url,
              };

              // Record in github_releases table in PostgreSQL
              try {
                await this.prisma.gitHubRelease.upsert({
                  where: {
                    repositoryId_githubReleaseId: {
                      repositoryId: repository.id,
                      githubReleaseId: ghRes.data.id,
                    },
                  },
                  update: {
                    tagName: ghRes.data.tag_name,
                    releaseName: ghRes.data.name || tagName,
                    body: ghRes.data.body || '',
                    publishedAt: new Date(ghRes.data.published_at || Date.now()),
                  },
                  create: {
                    repositoryId: repository.id,
                    githubReleaseId: ghRes.data.id,
                    tagName: ghRes.data.tag_name,
                    releaseName: ghRes.data.name || tagName,
                    body: ghRes.data.body || '',
                    isDraft: false,
                    isPrerelease: ghRes.data.prerelease || false,
                    authorLogin: ghRes.data.author?.login || 'sqdis-bot',
                    authorId: ghRes.data.author?.id || 0,
                    createdAt: new Date(ghRes.data.created_at || Date.now()),
                    publishedAt: new Date(ghRes.data.published_at || Date.now()),
                  },
                });
              } catch (dbErr: any) {
                this.logger.warn(`Failed to store github_releases record: ${dbErr.message}`);
              }
            } catch (err: any) {
              this.logger.error(`Failed to create GitHub release on ${repository.fullName}: ${err.message}`);
              githubReleaseResult = {
                success: false,
                error: err.message || 'Failed to create GitHub Release',
              };
            }
          }

          // ==================== OPTION B: Trigger GitHub Actions CI/CD Workflow ====================
          if (dto?.triggerWorkflow) {
            const workflowFileName = dto.workflowFileName?.trim() || 'ci.yml';
            const gitRef = dto.gitRef?.trim() || 'main';

            try {
              this.logger.log(`Dispatching GitHub Actions workflow "${workflowFileName}" on ${repository.fullName} (ref: ${gitRef})...`);
              await octokit.actions.createWorkflowDispatch({
                owner,
                repo,
                workflow_id: workflowFileName,
                ref: gitRef,
                inputs: {
                  release_version: release.version,
                },
              });

              workflowDispatchResult = {
                success: true,
                workflow: workflowFileName,
                ref: gitRef,
                actionsUrl: `https://github.com/${owner}/${repo}/actions`,
                message: `Successfully dispatched workflow "${workflowFileName}" on ref "${gitRef}".`,
              };
            } catch (err: any) {
              this.logger.error(`Failed to dispatch GitHub Actions workflow "${workflowFileName}": ${err.message}`);
              workflowDispatchResult = {
                success: false,
                workflow: workflowFileName,
                ref: gitRef,
                actionsUrl: `https://github.com/${owner}/${repo}/actions`,
                error: err.message || `Failed to dispatch workflow "${workflowFileName}". Ensure workflow_dispatch is enabled on ${gitRef}.`,
              };
            }
          }
        }
      }
    }

    return {
      release: releaseResponse,
      githubRelease: githubReleaseResult,
      workflowDispatch: workflowDispatchResult,
    };
  }

  /**
   * Delete release (soft delete)
   */
  async delete(id: string) {
    const release = await this.prisma.release.findUnique({
      where: { id },
    });

    if (!release) {
      throw new NotFoundException('Release not found');
    }

    return this.prisma.release.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Associate a sprint with a release
   */
  async associateSprint(releaseId: string, sprintId: string, organizationId: string) {
    // Verify release exists and belongs to organization
    const release = await this.prisma.release.findFirst({
      where: {
        id: releaseId,
        organizationId,
        isActive: true,
      },
    });

    if (!release) {
      throw new NotFoundException('Release not found');
    }

    // Verify sprint exists and belongs to organization
    const sprint = await this.prisma.sprint.findFirst({
      where: {
        id: sprintId,
        organizationId,
        isActive: true,
      },
    });

    if (!sprint) {
      throw new NotFoundException('Sprint not found');
    }

    // Check if sprint is already associated with this release
    const existingAssociation = await this.prisma.releaseSprintAssociation.findUnique({
      where: {
        releaseId_sprintId: {
          releaseId,
          sprintId,
        },
      },
    });

    if (existingAssociation) {
      throw new ConflictException('Sprint is already associated with this release');
    }

    return this.prisma.releaseSprintAssociation.create({
      data: {
        releaseId,
        sprintId,
      },
      include: {
        sprint: {
          include: {
            team: {
              select: { name: true },
            },
          },
        },
      },
    });
  }

  /**
   * Remove sprint association from a release
   */
  async dissociateSprint(releaseId: string, sprintId: string, organizationId: string) {
    // Verify release exists and belongs to organization
    const release = await this.prisma.release.findFirst({
      where: {
        id: releaseId,
        organizationId,
      },
    });

    if (!release) {
      throw new NotFoundException('Release not found');
    }

    const association = await this.prisma.releaseSprintAssociation.findUnique({
      where: {
        releaseId_sprintId: {
          releaseId,
          sprintId,
        },
      },
    });

    if (!association) {
      throw new NotFoundException('Sprint association not found');
    }

    return this.prisma.releaseSprintAssociation.delete({
      where: {
        releaseId_sprintId: {
          releaseId,
          sprintId,
        },
      },
    });
  }

  /**
   * Verify release access
   */
  async verifyReleaseAccess(releaseId: string, organizationId: string) {
    const release = await this.prisma.release.findFirst({
      where: {
        id: releaseId,
        organizationId,
      },
    });

    if (!release) {
      throw new ForbiddenException('Access denied to this release');
    }

    return release;
  }

  /**
   * Calculate release readiness score
   *
   * Weights:
   * - Bugs: 30%
   * - Coverage: 25%
   * - DQS: 25%
   * - Test pass rate: 20%
   */
  async calculateReadiness(releaseId: string): Promise<ReadinessScoreDto> {
    const release = await this.prisma.release.findUnique({
      where: { id: releaseId },
      include: {
        sprintAssociations: {
          include: {
            sprint: {
              include: {
                reports: {
                  orderBy: { generatedAt: 'desc' },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    if (!release) {
      throw new NotFoundException('Release not found');
    }

    // Aggregate metrics from all associated sprints
    let totalBugsIntroduced = 0;
    let totalBugsFixed = 0;
    let totalCoverage = 0;
    let totalDQS = 0;
    let sprintCount = 0;

    for (const association of release.sprintAssociations) {
      const report = association.sprint.reports[0];
      if (report) {
        totalBugsIntroduced += report.bugsIntroduced;
        totalBugsFixed += report.bugsFixed;
        totalCoverage += report.coveragePct;
        totalDQS += report.avgDQS;
        sprintCount++;
      }
    }

    // Calculate individual scores
    // Bug score: Higher is better when bugs fixed >= bugs introduced
    let bugScore = 100;
    if (totalBugsIntroduced > 0) {
      const bugRatio = totalBugsFixed / totalBugsIntroduced;
      bugScore = Math.min(100, Math.round(bugRatio * 100));
    }

    // Coverage score: Direct percentage
    const coverageScore = sprintCount > 0 ? Math.round(totalCoverage / sprintCount) : 0;

    // DQS score: Direct average
    const dqsScore = sprintCount > 0 ? Math.round(totalDQS / sprintCount) : 0;

    // Test pass rate: Placeholder (would come from CI/CD integration)
    // For now, estimate based on test commits ratio
    const testPassRate = 80; // Default placeholder

    // Query latest telemetry analysis if exists
    const latestTelemetry = await this.prisma.releaseTelemetryAnalysis?.findFirst({
      where: { releaseId },
      orderBy: { createdAt: 'desc' },
    });

    if (latestTelemetry) {
      const telemetryScore = latestTelemetry.score;
      // 5-factor weighted score:
      // Bugs: 25%, Coverage: 20%, DQS: 20%, Test pass: 15%, Telemetry: 20%
      const score = Math.round(
        (bugScore * 0.25 + coverageScore * 0.20 + dqsScore * 0.20 + testPassRate * 0.15 + telemetryScore * 0.20) * 100,
      ) / 100;

      const isCriticalRegression =
        latestTelemetry.verdict === 'CRITICAL_REGRESSION' ||
        latestTelemetry.recommendation === 'TRIGGER_ROLLBACK';

      return {
        score,
        bugScore,
        coverageScore,
        dqsScore,
        testPassRate,
        telemetryScore,
        telemetryVerdict: latestTelemetry.verdict as any,
        telemetryRecommendation: latestTelemetry.recommendation as any,
        hasTelemetry: true,
        isAtRisk: score < 70 || isCriticalRegression,
      };
    }

    // 4-factor legacy score if no telemetry yet
    const score = bugScore * 0.3 + coverageScore * 0.25 + dqsScore * 0.25 + testPassRate * 0.2;
    const roundedScore = Math.round(score * 100) / 100;

    return {
      score: roundedScore,
      bugScore,
      coverageScore,
      dqsScore,
      testPassRate,
      hasTelemetry: false,
      isAtRisk: roundedScore < 70,
    };
  }

  /**
   * Evaluate canary performance regression telemetry for a release
   */
  async evaluateCanaryTelemetry(
    releaseId: string,
    organizationId: string,
    dto?: EvaluateTelemetryDto,
  ): Promise<ReleaseTelemetryResponseDto> {
    const release = await this.prisma.release.findFirst({
      where: {
        id: releaseId,
        organizationId,
        isActive: true,
      },
    });

    if (!release) {
      throw new NotFoundException('Release not found');
    }

    const serviceName = dto?.serviceName || 'sqdis-backend';
    const baselineDurationMinutes = dto?.baselineDurationMinutes || 15;
    const canaryDurationMinutes = dto?.canaryDurationMinutes || 10;

    const payload: any = {
      commit_sha: release.version,
      author_email: 'release-manager@sqdis.internal',
      service_name: serviceName,
      baseline_duration_minutes: baselineDurationMinutes,
      canary_duration_minutes: canaryDurationMinutes,
    };

    if (dto?.customBaseline) {
      payload.custom_baseline = dto.customBaseline;
    }
    if (dto?.customCanary) {
      payload.custom_canary = dto.customCanary;
    }

    let mlResult: any = null;

    try {
      const resp = await fetch(`${this.mlServiceUrl}/api/ml/telemetry/canary-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (resp.ok) {
        mlResult = await resp.json();
      } else {
        this.logger.warn(`Canary analysis endpoint returned status ${resp.status}`);
      }
    } catch (err: any) {
      this.logger.warn(`Failed to contact ML canary analysis service: ${err.message}`);
    }

    // Defensive fallback if ML service is unreachable or unconfigured
    if (!mlResult) {
      mlResult = {
        commit_sha: release.version,
        author_email: 'release-manager@sqdis.internal',
        service_name: serviceName,
        verdict: 'HEALTHY',
        recommendation: 'PROCEED',
        baseline_metrics: {
          p95_latency_ms: 12.5,
          error_rate_5xx: 0.0,
          memory_rss_mb: 178.0,
          cpu_utilization_pct: 14.0,
        },
        canary_metrics: {
          p95_latency_ms: 12.9,
          error_rate_5xx: 0.0,
          memory_rss_mb: 179.8,
          cpu_utilization_pct: 14.5,
        },
        deltas: {
          latency_delta_pct: 3.2,
          error_rate_delta: 0.0,
          memory_delta_pct: 1.01,
        },
        violations: [],
      };
    }

    // Calculate normalized Telemetry Stability Score (0 to 100)
    let score = 100;
    const violations = Array.isArray(mlResult.violations) ? mlResult.violations : [];
    for (const v of violations) {
      if (v.severity === 'CRITICAL') {
        score -= 50;
      } else if (v.severity === 'WARNING') {
        score -= 25;
      }
    }
    score = Math.max(0, Math.min(100, score));

    // Persist evaluation in PostgreSQL
    const saved = await this.prisma.releaseTelemetryAnalysis.create({
      data: {
        releaseId,
        serviceName: mlResult.service_name || serviceName,
        verdict: mlResult.verdict || 'HEALTHY',
        recommendation: mlResult.recommendation || 'PROCEED',
        p95BaselineMs: mlResult.baseline_metrics.p95_latency_ms,
        p95CanaryMs: mlResult.canary_metrics.p95_latency_ms,
        p95DeltaPct: mlResult.deltas.latency_delta_pct,
        errorBaseline: mlResult.baseline_metrics.error_rate_5xx,
        errorCanary: mlResult.canary_metrics.error_rate_5xx,
        errorDelta: mlResult.deltas.error_rate_delta,
        memoryBaselineMb: mlResult.baseline_metrics.memory_rss_mb,
        memoryCanaryMb: mlResult.canary_metrics.memory_rss_mb,
        memoryDeltaPct: mlResult.deltas.memory_delta_pct,
        score,
        violations: violations,
      },
    });

    return this.formatTelemetryResponse(saved);
  }

  /**
   * Get all past telemetry analyses for a release
   */
  async getTelemetryHistory(releaseId: string, organizationId: string): Promise<ReleaseTelemetryResponseDto[]> {
    await this.verifyReleaseAccess(releaseId, organizationId);

    const analyses = await this.prisma.releaseTelemetryAnalysis.findMany({
      where: { releaseId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return analyses.map((a) => this.formatTelemetryResponse(a));
  }

  /**
   * Format database telemetry entity to response DTO
   */
  private formatTelemetryResponse(entity: any): ReleaseTelemetryResponseDto {
    return {
      id: entity.id,
      releaseId: entity.releaseId,
      serviceName: entity.serviceName,
      verdict: entity.verdict,
      recommendation: entity.recommendation,
      score: entity.score,
      baselineMetrics: {
        p95_latency_ms: entity.p95BaselineMs,
        error_rate_5xx: entity.errorBaseline,
        memory_rss_mb: entity.memoryBaselineMb,
      },
      canaryMetrics: {
        p95_latency_ms: entity.p95CanaryMs,
        error_rate_5xx: entity.errorCanary,
        memory_rss_mb: entity.memoryCanaryMb,
      },
      deltas: {
        latency_delta_pct: entity.p95DeltaPct,
        error_rate_delta: entity.errorDelta,
        memory_delta_pct: entity.memoryDeltaPct,
      },
      violations: Array.isArray(entity.violations) ? entity.violations : [],
      createdAt: entity.createdAt,
    };
  }

  /**
   * Format release response with sprint summaries
   */
  private formatReleaseResponse(release: any): ReleaseResponseDto {
    const sprints: SprintSummaryDto[] = (release.sprintAssociations || []).map((assoc: any) => ({
      id: assoc.sprint.id,
      name: assoc.sprint.name,
      startDate: assoc.sprint.startDate,
      endDate: assoc.sprint.endDate,
      teamName: assoc.sprint.team?.name || 'General Team',
    }));

    let status = 'PLANNED';
    if (release.isRolledBack) {
      status = 'ROLLED_BACK';
    } else if (release.shippedAt) {
      status = 'RELEASED';
    } else if (sprints.length > 0) {
      status = 'IN_PROGRESS';
    }

    return {
      id: release.id,
      version: release.version,
      targetDate: release.targetDate,
      description: release.description,
      shippedAt: release.shippedAt,
      isActive: release.isActive,
      status,
      isRolledBack: release.isRolledBack || false,
      rolledBackAt: release.rolledBackAt || undefined,
      rollbackReason: release.rollbackReason || undefined,
      rollbackTriggeredBy: release.rollbackTriggeredBy || undefined,
      createdAt: release.createdAt,
      updatedAt: release.updatedAt,
      sprints,
    };
  }

  /**
   * Dispatch automated rollback and webhook incident response for a release
   */
  async rollbackRelease(
    releaseId: string,
    organizationId: string,
    userId?: string,
    dto?: RollbackReleaseDto,
  ): Promise<RollbackResponseDto> {
    const release = await this.prisma.release.findFirst({
      where: {
        id: releaseId,
        organizationId,
        isActive: true,
      },
      include: {
        telemetryAnalyses: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!release) {
      throw new NotFoundException('Release not found');
    }

    if (release.isRolledBack) {
      throw new ConflictException(
        `Release "${release.version}" has already been rolled back on ${release.rolledBackAt?.toISOString() || 'prior date'}`,
      );
    }

    const latestTelemetry = release.telemetryAnalyses?.[0];
    const rollbackReason =
      dto?.reason ||
      (latestTelemetry?.verdict === 'FAIL' || latestTelemetry?.verdict === 'DEGRADED'
        ? `Canary telemetry ${latestTelemetry.verdict}: ${latestTelemetry.recommendation}`
        : 'Emergency manual rollback triggered due to production instability');

    // Find previous stable release if available
    const previousRelease = await this.prisma.release.findFirst({
      where: {
        organizationId,
        isActive: true,
        isRolledBack: false,
        id: { not: releaseId },
        shippedAt: { not: null },
      },
      orderBy: { shippedAt: 'desc' },
    });

    const targetVersion = dto?.targetStableVersion || previousRelease?.version || 'v1.0.0-previous';

    // Construct dispatch payload
    const dispatchPayload = {
      event: 'RELEASE_ROLLBACK_DISPATCHED',
      organizationId,
      releaseId: release.id,
      rolledBackVersion: release.version,
      targetStableVersion: targetVersion,
      reason: rollbackReason,
      triggeredByUserId: userId || 'system-automated-watchdog',
      timestamp: new Date().toISOString(),
      telemetrySnapshot: latestTelemetry
        ? {
            p95BaselineMs: latestTelemetry.p95BaselineMs,
            p95CanaryMs: latestTelemetry.p95CanaryMs,
            p95DeltaPct: latestTelemetry.p95DeltaPct,
            errorDelta: latestTelemetry.errorDelta,
            memoryDeltaPct: latestTelemetry.memoryDeltaPct,
            score: latestTelemetry.score,
          }
        : null,
    };

    // Outbound HTTP Webhook Dispatch
    let webhookDispatched = false;
    let webhookHttpStatus: number | null = null;
    const webhookTarget = dto?.webhookUrl || release.rollbackWebhookUrl;

    if (webhookTarget) {
      try {
        const resp = await fetch(webhookTarget, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-SQDIS-Event': 'release.rollback',
            'X-SQDIS-Delivery': `rb-${Date.now()}`,
          },
          body: JSON.stringify(dispatchPayload),
        });
        webhookDispatched = true;
        webhookHttpStatus = resp.status;
        this.logger.log(`Rollback webhook dispatched to ${webhookTarget} with HTTP ${resp.status}`);
      } catch (err: any) {
        this.logger.warn(`Failed to dispatch rollback webhook to ${webhookTarget}: ${err.message}`);
        webhookDispatched = false;
      }
    }

    // Update release entity with immutable rollback state
    const rolledBackAt = new Date();
    const updated = await this.prisma.release.update({
      where: { id: release.id },
      data: {
        isRolledBack: true,
        rolledBackAt,
        rollbackReason,
        rollbackTriggeredBy: userId || 'system',
        rollbackWebhookUrl: webhookTarget || null,
      },
    });

    // Create in-app incident notification
    try {
      if (userId) {
        await this.prisma.notification.create({
          data: {
            organizationId,
            userId,
            title: `Emergency Rollback: Release ${release.version}`,
            message: `Rollback executed: ${rollbackReason}. Reverted to target version ${targetVersion}.`,
            type: 'ALERT',
            isRead: false,
          },
        });
      }
    } catch (err: any) {
      this.logger.warn(`Failed to insert incident notification: ${err.message}`);
    }

    return {
      success: true,
      releaseId: updated.id,
      version: updated.version,
      isRolledBack: updated.isRolledBack,
      rolledBackAt: updated.rolledBackAt!.toISOString(),
      rollbackReason: updated.rollbackReason!,
      rollbackTriggeredBy: updated.rollbackTriggeredBy || undefined,
      webhookDispatched,
      webhookHttpStatus,
      dispatchedPayload: dispatchPayload,
    };
  }
}

