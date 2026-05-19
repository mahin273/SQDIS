import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma';
import { DebtItem, DebtMarker, Prisma } from '@prisma/client';
import {
  DebtFilters,
  PaginatedResult,
  HotSpot,
  DebtTrend,
  DebtTrendPoint,
  DebtRecommendation,
  DebtAttribution,
  ModuleDebtScore,
  ScannedDebtMarker,
} from './interfaces';
import { DebtScannerService } from './services';

/**
 * Service for managing technical debt tracking
 */
@Injectable()
export class DebtService {
  private readonly logger = new Logger(DebtService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly debtScanner: DebtScannerService,
  ) {}

  /**
   * Find all debt items with pagination and filters
   */
  async findAll(organizationId: string, filters: DebtFilters): Promise<PaginatedResult<DebtItem>> {
    const {
      page = 1,
      limit = 20,
      repositoryId,
      authorId,
      markerType,
      isResolved,
      startDate,
      endDate,
      filePath,
    } = filters;
    const skip = (page - 1) * limit;

    const where: Prisma.DebtItemWhereInput = {
      repository: { organizationId },
    };

    if (repositoryId) where.repositoryId = repositoryId;
    if (authorId) where.authorId = authorId;
    if (markerType) where.markerType = markerType;
    if (isResolved !== undefined) where.isResolved = isResolved;
    if (filePath) where.filePath = { contains: filePath };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [data, total] = await Promise.all([
      this.prisma.debtItem.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          author: { select: { id: true, name: true, email: true, avatarUrl: true } },
          repository: { select: { id: true, name: true, fullName: true } },
          resolver: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
      }),
      this.prisma.debtItem.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Find a debt item by ID
   */
  async findById(id: string): Promise<DebtItem | null> {
    return this.prisma.debtItem.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, name: true, email: true, avatarUrl: true } },
        repository: { select: { id: true, name: true, fullName: true } },
        resolver: { select: { id: true, name: true, email: true, avatarUrl: true } },
        introducedCommit: { select: { id: true, sha: true, message: true } },
        resolvedCommit: { select: { id: true, sha: true, message: true } },
      },
    });
  }

  /**
   * Create a new debt item
   */
  async create(data: {
    repositoryId: string;
    commitId?: string;
    authorId?: string;
    markerType: DebtMarker;
    content: string;
    filePath: string;
    lineNumber: number;
  }): Promise<DebtItem> {
    return await this.prisma.debtItem.create({
      data: {
        repositoryId: data.repositoryId,
        introducedCommitId: data.commitId,
        authorId: data.authorId,
        markerType: data.markerType,
        content: data.content,
        filePath: data.filePath,
        lineNumber: data.lineNumber,
      },
    });
  }

  /**
   * Resolve a debt item
   *
   * @param debtId - The debt item ID to resolve
   * @param resolverId - The user ID of the resolver (from commit author)
   * @param commitId - The commit ID that resolved the debt
   * @returns The updated debt item with resolution details
   */
  async resolve(debtId: string, resolverId: string, commitId?: string): Promise<DebtItem> {
    const resolvedAt = new Date();

    const debtItem = await this.prisma.debtItem.update({
      where: { id: debtId },
      data: {
        isResolved: true,
        resolvedAt,
        resolverId,
        resolvedCommitId: commitId,
      },
    });

    // Log time-to-resolution for metrics
    const timeToResolution = resolvedAt.getTime() - debtItem.createdAt.getTime();
    const daysToResolve = Math.round(timeToResolution / (1000 * 60 * 60 * 24));
    this.logger.debug(
      `Debt item ${debtId} resolved after ${daysToResolve} days by user ${resolverId}`,
    );

    return debtItem;
  }

  /**
   * Calculate time-to-resolution metric for a debt item
   *
   * @param debtItem - The debt item to calculate time-to-resolution for
   * @returns Time to resolution in milliseconds, or null if not resolved
   */
  calculateTimeToResolution(debtItem: DebtItem): number | null {
    if (!debtItem.isResolved || !debtItem.resolvedAt) {
      return null;
    }
    return debtItem.resolvedAt.getTime() - debtItem.createdAt.getTime();
  }

  /**
   * Get average time-to-resolution for an organization
   *
   * @param organizationId - The organization ID
   * @param repositoryId - Optional repository filter
   * @returns Average time to resolution in days
   */
  async getAverageTimeToResolution(
    organizationId: string,
    repositoryId?: string,
  ): Promise<number | null> {
    const where: Prisma.DebtItemWhereInput = {
      repository: { organizationId },
      isResolved: true,
      resolvedAt: { not: null },
    };
    if (repositoryId) where.repositoryId = repositoryId;

    const resolvedItems = await this.prisma.debtItem.findMany({
      where,
      select: {
        createdAt: true,
        resolvedAt: true,
      },
    });

    if (resolvedItems.length === 0) {
      return null;
    }

    const totalMs = resolvedItems.reduce((sum, item) => {
      if (item.resolvedAt) {
        return sum + (item.resolvedAt.getTime() - item.createdAt.getTime());
      }
      return sum;
    }, 0);

    const avgMs = totalMs / resolvedItems.length;
    return Math.round(avgMs / (1000 * 60 * 60 * 24)); // Convert to days
  }

  /**
   * Update debt item location (when marker is moved)
   */
  async updateLocation(debtId: string, filePath: string, lineNumber: number): Promise<DebtItem> {
    return await this.prisma.debtItem.update({
      where: { id: debtId },
      data: { filePath, lineNumber },
    });
  }

  /**
   * Get hot spots - files with high churn and bug correlation
   */
  async getHotSpots(organizationId: string, repositoryId?: string): Promise<HotSpot[]> {
    // Get file changes with churn data
    const fileChanges = await this.prisma.fileChange.groupBy({
      by: ['filePath'],
      where: {
        commit: {
          repository: {
            organizationId,
            ...(repositoryId && { id: repositoryId }),
          },
        },
      },
      _avg: { churnRatio: true },
      _count: { id: true },
    });

    // Get debt counts per file
    const debtCounts = await this.prisma.debtItem.groupBy({
      by: ['filePath', 'repositoryId'],
      where: {
        repository: {
          organizationId,
          ...(repositoryId && { id: repositoryId }),
        },
        isResolved: false,
      },
      _count: { id: true },
    });

    // Get bug fix commits per file
    const bugfixCommits = await this.prisma.fileChange.findMany({
      where: {
        commit: {
          classification: 'BUGFIX',
          repository: {
            organizationId,
            ...(repositoryId && { id: repositoryId }),
          },
        },
      },
      select: {
        filePath: true,
        commit: {
          select: {
            repositoryId: true,
            repository: { select: { name: true } },
          },
        },
      },
    });

    // Aggregate bug counts per file
    const bugCountMap = new Map<string, { count: number; repoId: string; repoName: string }>();
    for (const fc of bugfixCommits) {
      const key = `${fc.commit.repositoryId}:${fc.filePath}`;
      const existing = bugCountMap.get(key) || {
        count: 0,
        repoId: fc.commit.repositoryId,
        repoName: fc.commit.repository.name,
      };
      existing.count++;
      bugCountMap.set(key, existing);
    }

    // Build hot spots
    const hotSpots: HotSpot[] = [];
    const debtMap = new Map<string, number>();
    for (const d of debtCounts) {
      debtMap.set(`${d.repositoryId}:${d.filePath}`, d._count.id);
    }

    for (const fc of fileChanges) {
      const churnRatio = fc._avg.churnRatio || 0;

      // Find matching bug and debt data
      for (const [key, bugData] of bugCountMap) {
        if (key.endsWith(`:${fc.filePath}`)) {
          const debtCount = debtMap.get(key) || 0;
          const severity = this.calculateHotSpotSeverity(churnRatio, bugData.count, debtCount);

          if (severity !== 'LOW') {
            hotSpots.push({
              filePath: fc.filePath,
              repositoryId: bugData.repoId,
              repositoryName: bugData.repoName,
              churnRatio,
              bugCount: bugData.count,
              debtCount,
              severity,
            });
          }
        }
      }
    }

    // Sort by severity and return top results
    return hotSpots
      .sort((a, b) => {
        const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      })
      .slice(0, 20);
  }

  /**
   * Calculate hot spot severity based on churn, bugs, and debt
   */
  private calculateHotSpotSeverity(
    churnRatio: number,
    bugCount: number,
    debtCount: number,
  ): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const score = churnRatio * 10 + bugCount * 2 + debtCount;

    if (score >= 20) return 'CRITICAL';
    if (score >= 10) return 'HIGH';
    if (score >= 5) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Get debt trends over time6
   */
  async getTrends(
    organizationId: string,
    days: number = 30,
    repositoryId?: string,
    teamId?: string,
  ): Promise<DebtTrend> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const where: Prisma.DebtItemWhereInput = {
      repository: { organizationId },
    };
    if (repositoryId) where.repositoryId = repositoryId;

    // Get all debt items created or resolved in the period
    const debtItems = await this.prisma.debtItem.findMany({
      where: {
        ...where,
        OR: [{ createdAt: { gte: startDate } }, { resolvedAt: { gte: startDate } }],
      },
      select: {
        createdAt: true,
        resolvedAt: true,
        isResolved: true,
      },
    });

    // Group by date
    const pointsMap = new Map<string, DebtTrendPoint>();

    for (let i = 0; i <= days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateKey = date.toISOString().split('T')[0];
      pointsMap.set(dateKey, {
        date: new Date(dateKey),
        totalDebt: 0,
        addedDebt: 0,
        resolvedDebt: 0,
        netDebt: 0,
      });
    }

    // Count added and resolved per day
    for (const item of debtItems) {
      const createdKey = item.createdAt.toISOString().split('T')[0];
      const point = pointsMap.get(createdKey);
      if (point) {
        point.addedDebt++;
      }

      if (item.resolvedAt) {
        const resolvedKey = item.resolvedAt.toISOString().split('T')[0];
        const resolvedPoint = pointsMap.get(resolvedKey);
        if (resolvedPoint) {
          resolvedPoint.resolvedDebt++;
        }
      }
    }

    // Calculate running totals
    const points = Array.from(pointsMap.values()).sort(
      (a, b) => a.date.getTime() - b.date.getTime(),
    );

    // Get initial debt count
    const initialDebt = await this.prisma.debtItem.count({
      where: {
        ...where,
        createdAt: { lt: startDate },
        OR: [{ isResolved: false }, { resolvedAt: { gte: startDate } }],
      },
    });

    let runningTotal = initialDebt;
    for (const point of points) {
      runningTotal += point.addedDebt - point.resolvedDebt;
      point.totalDebt = runningTotal;
      point.netDebt = point.addedDebt - point.resolvedDebt;
    }

    // Calculate velocity (average net debt per day)
    const totalNet = points.reduce((sum, p) => sum + p.netDebt, 0);
    const velocity = totalNet / days;

    return {
      points,
      velocity,
      isAccumulating: velocity > 0,
    };
  }

  /**
   * Get prioritized debt recommendations
   */
  async getRecommendations(
    organizationId: string,
    repositoryId?: string,
    limit: number = 10,
  ): Promise<DebtRecommendation[]> {
    const where: Prisma.DebtItemWhereInput = {
      repository: { organizationId },
      isResolved: false,
    };
    if (repositoryId) where.repositoryId = repositoryId;

    // Group debt by file
    const debtByFile = await this.prisma.debtItem.groupBy({
      by: ['filePath', 'repositoryId'],
      where,
      _count: { id: true },
    });

    // Get repository names
    const repoIds: string[] = [
      ...new Set(debtByFile.map((d: { repositoryId: string }) => d.repositoryId)),
    ];
    const repos = await this.prisma.repository.findMany({
      where: { id: { in: repoIds } },
      select: { id: true, name: true },
    });
    const repoMap = new Map(repos.map((r) => [r.id, r.name]));

    // Get file complexity (based on churn and change frequency)
    const fileComplexity = await this.prisma.fileChange.groupBy({
      by: ['filePath'],
      where: {
        commit: { repository: { organizationId } },
      },
      _avg: { churnRatio: true },
      _count: { id: true },
    });
    const complexityMap = new Map(
      fileComplexity.map((f) => [
        f.filePath,
        { churn: f._avg.churnRatio || 0, changes: f._count.id },
      ]),
    );

    // Build recommendations
    const recommendations: DebtRecommendation[] = debtByFile.map(
      (d: { filePath: string; repositoryId: string; _count: { id: number } }, index: number) => {
        const complexity = complexityMap.get(d.filePath) || { churn: 0, changes: 0 };
        const markerCount = d._count.id;

        // Calculate impact (higher = more important to fix)
        const impact = markerCount * 2 + complexity.churn * 10 + complexity.changes * 0.5;

        // Calculate effort (higher = harder to fix)
        const effort = markerCount + complexity.churn * 5;

        // Priority = impact / effort (higher = better ROI)
        const priority = effort > 0 ? impact / effort : impact;

        return {
          id: `rec-${index}`,
          filePath: d.filePath,
          repositoryId: d.repositoryId,
          repositoryName: repoMap.get(d.repositoryId) || 'Unknown',
          markerCount,
          complexity: complexity.churn,
          impact,
          effort,
          priority,
          rationale: this.generateRationale(markerCount, complexity.churn, complexity.changes),
        };
      },
    );

    // Sort by priority and return top results
    return recommendations.sort((a, b) => b.priority - a.priority).slice(0, limit);
  }

  /**
   * Generate rationale for a recommendation
   */
  private generateRationale(markerCount: number, churn: number, changes: number): string {
    const reasons: string[] = [];

    if (markerCount >= 5) {
      reasons.push(`High debt concentration (${markerCount} markers)`);
    } else if (markerCount >= 2) {
      reasons.push(`Multiple debt markers (${markerCount})`);
    }

    if (churn > 0.5) {
      reasons.push('High code churn indicates instability');
    }

    if (changes > 20) {
      reasons.push('Frequently modified file');
    }

    return reasons.length > 0 ? reasons.join('. ') : 'Standard debt item';
  }

  /**
   * Get debt attribution by developer
   */
  async getAttribution(organizationId: string): Promise<DebtAttribution[]> {
    // Get debt introduced per developer
    const introduced = await this.prisma.debtItem.groupBy({
      by: ['authorId'],
      where: {
        repository: { organizationId },
        authorId: { not: null },
      },
      _count: { id: true },
    });

    // Get debt resolved per developer
    const resolved = await this.prisma.debtItem.groupBy({
      by: ['resolverId'],
      where: {
        repository: { organizationId },
        resolverId: { not: null },
        isResolved: true,
      },
      _count: { id: true },
    });

    // Get all developer IDs
    const developerIds = new Set<string>();
    introduced.forEach(
      (i: { authorId: string | null; _count: { id: number } }) =>
        i.authorId && developerIds.add(i.authorId),
    );
    resolved.forEach(
      (r: { resolverId: string | null; _count: { id: number } }) =>
        r.resolverId && developerIds.add(r.resolverId),
    );

    // Get developer details
    const developers = await this.prisma.user.findMany({
      where: { id: { in: Array.from(developerIds) } },
      select: { id: true, name: true, email: true, avatarUrl: true },
    });
    const devMap = new Map(developers.map((d) => [d.id, d]));

    // Build attribution
    const introducedMap = new Map<string | null, number>(
      introduced.map((i: { authorId: string | null; _count: { id: number } }) => [
        i.authorId,
        i._count.id,
      ]),
    );
    const resolvedMap = new Map<string | null, number>(
      resolved.map((r: { resolverId: string | null; _count: { id: number } }) => [
        r.resolverId,
        r._count.id,
      ]),
    );

    const attributions: DebtAttribution[] = [];
    for (const devId of developerIds) {
      const dev = devMap.get(devId);
      if (!dev) continue;

      const debtIntroduced = introducedMap.get(devId) || 0;
      const debtResolved = resolvedMap.get(devId) || 0;

      attributions.push({
        developerId: dev.id,
        developerName: dev.name,
        developerEmail: dev.email,
        avatarUrl: dev.avatarUrl || undefined,
        debtIntroduced,
        debtResolved,
        netDebt: debtIntroduced - debtResolved,
      });
    }

    // Sort by net debt descending
    return attributions.sort((a, b) => b.netDebt - a.netDebt);
  }

  /**
   * Calculate module debt score
   * Weights: HACK=3x, FIXME=2x, TODO=1x, XXX=2x
   */
  async getModuleDebtScore(
    organizationId: string,
    repositoryId?: string,
    threshold: number = 10,
  ): Promise<ModuleDebtScore[]> {
    const where: Prisma.DebtItemWhereInput = {
      repository: { organizationId },
      isResolved: false,
    };
    if (repositoryId) where.repositoryId = repositoryId;

    // Get debt items grouped by module (directory)
    const debtItems = await this.prisma.debtItem.findMany({
      where,
      select: {
        filePath: true,
        repositoryId: true,
        markerType: true,
      },
    });

    // Group by module (parent directory)
    const moduleMap = new Map<
      string,
      {
        repositoryId: string;
        todo: number;
        fixme: number;
        hack: number;
        xxx: number;
      }
    >();

    for (const item of debtItems) {
      const modulePath = item.filePath.split('/').slice(0, -1).join('/') || '/';
      const key = `${item.repositoryId}:${modulePath}`;

      if (!moduleMap.has(key)) {
        moduleMap.set(key, {
          repositoryId: item.repositoryId,
          todo: 0,
          fixme: 0,
          hack: 0,
          xxx: 0,
        });
      }

      const module = moduleMap.get(key)!;
      switch (item.markerType) {
        case 'TODO':
          module.todo++;
          break;
        case 'FIXME':
          module.fixme++;
          break;
        case 'HACK':
          module.hack++;
          break;
        case 'XXX':
          module.xxx++;
          break;
      }
    }

    // Calculate scores
    const scores: ModuleDebtScore[] = [];
    for (const [key, module] of moduleMap) {
      const modulePath = key.split(':').slice(1).join(':');
      // Weights: HACK=3x, FIXME=2x, TODO=1x, XXX=2x
      const score = module.todo * 1 + module.fixme * 2 + module.hack * 3 + module.xxx * 2;

      scores.push({
        modulePath,
        repositoryId: module.repositoryId,
        score,
        todoCount: module.todo,
        fixmeCount: module.fixme,
        hackCount: module.hack,
        xxxCount: module.xxx,
        exceedsThreshold: score >= threshold,
      });
    }

    // Sort by score descending
    return scores.sort((a, b) => b.score - a.score);
  }

  /**
   * Scan a commit for debt markers and create debt items
   *
   * This method handles:
   * - Creating new debt items for added markers
   * - Resolving debt items for removed markers
   * - Detecting marker movement (same content moved to different location)
   *   and updating location instead of creating duplicates
   *
   * @param commitId - The commit ID
   * @param repositoryId - The repository ID
   * @param developerId - The developer ID (if attributed)
   * @param filePatches - Array of file patches from the commit
   * @returns Array of created debt items
   */
  async scanCommit(
    commitId: string,
    repositoryId: string,
    developerId: string | null,
    filePatches: Array<{ filePath: string; patch: string }>,
  ): Promise<DebtItem[]> {
    const createdItems: DebtItem[] = [];

    // Collect all added and removed markers across all files
    const allAddedMarkers: ScannedDebtMarker[] = [];
    const allRemovedMarkers: ScannedDebtMarker[] = [];

    for (const { filePath, patch } of filePatches) {
      // Skip unsupported file types
      if (!this.debtScanner.isFileSupported(filePath)) {
        continue;
      }

      // Scan for new debt markers in added lines
      const newMarkers = this.debtScanner.scanDiffPatch(filePath, patch);
      allAddedMarkers.push(...newMarkers);

      // Scan for removed debt markers in deleted lines
      const removedMarkers = this.debtScanner.scanDiffPatchForRemovals(filePath, patch);
      allRemovedMarkers.push(...removedMarkers);
    }

    // Detect marker movements: same marker type and similar content
    // removed from one location and added to another
    const { movedMarkers, purelyAddedMarkers, purelyRemovedMarkers } = this.detectMarkerMovements(
      allAddedMarkers,
      allRemovedMarkers,
    );

    // Handle moved markers - update location instead of creating duplicates
    for (const { removed, added } of movedMarkers) {
      try {
        const updated = await this.handleMarkerMovement(repositoryId, removed, added);
        if (updated) {
          this.logger.debug(
            `Updated debt item location: ${removed.markerType} moved from ` +
              `${removed.filePath}:${removed.lineNumber} to ${added.filePath}:${added.lineNumber}`,
          );
        }
      } catch (error) {
        this.logger.warn(`Failed to handle marker movement for ${removed.markerType}: ${error}`);
      }
    }

    // Create debt items for purely new markers (not moved)
    for (const marker of purelyAddedMarkers) {
      try {
        const debtItem = await this.create({
          repositoryId,
          commitId,
          authorId: developerId || undefined,
          markerType: marker.markerType,
          content: marker.content,
          filePath: marker.filePath,
          lineNumber: marker.lineNumber,
        });
        createdItems.push(debtItem);
        this.logger.debug(
          `Created debt item: ${marker.markerType} at ${marker.filePath}:${marker.lineNumber}`,
        );
      } catch (error) {
        this.logger.warn(
          `Failed to create debt item for ${marker.markerType} at ${marker.filePath}:${marker.lineNumber}: ${error}`,
        );
      }
    }

    // Resolve purely removed markers (not moved)
    // Track resolver from commit author (developerId)
    for (const marker of purelyRemovedMarkers) {
      try {
        const resolved = await this.resolveMatchingDebt(
          repositoryId,
          marker.filePath,
          marker.markerType,
          marker.content,
          developerId, // Resolver tracked from commit author
          commitId,
        );
        if (resolved) {
          this.logger.debug(
            `Resolved debt item via commit ${commitId}: ${marker.markerType} at ${marker.filePath}`,
          );
        }
      } catch (error) {
        this.logger.warn(
          `Failed to resolve debt item for ${marker.markerType} at ${marker.filePath}: ${error}`,
        );
      }
    }

    if (createdItems.length > 0 || movedMarkers.length > 0) {
      this.logger.log(
        `Scanned commit ${commitId}: ${createdItems.length} new, ` +
          `${movedMarkers.length} moved, ${purelyRemovedMarkers.length} resolved`,
      );
    }

    return createdItems;
  }

  /**
   * Detect marker movements by matching removed and added markers
   *
   * A marker is considered "moved" if:
   * - Same marker type (TODO, FIXME, etc.)
   * - Similar content (using fuzzy matching)
   * - Removed from one location and added to another in the same commit
   *
   * @param addedMarkers - Markers found in added lines
   * @param removedMarkers - Markers found in removed lines
   * @returns Object containing moved, purely added, and purely removed markers
   */
  private detectMarkerMovements(
    addedMarkers: ScannedDebtMarker[],
    removedMarkers: ScannedDebtMarker[],
  ): {
    movedMarkers: Array<{ removed: ScannedDebtMarker; added: ScannedDebtMarker }>;
    purelyAddedMarkers: ScannedDebtMarker[];
    purelyRemovedMarkers: ScannedDebtMarker[];
  } {
    const movedMarkers: Array<{ removed: ScannedDebtMarker; added: ScannedDebtMarker }> = [];
    const matchedAddedIndices = new Set<number>();
    const matchedRemovedIndices = new Set<number>();

    // Try to match removed markers with added markers
    for (let ri = 0; ri < removedMarkers.length; ri++) {
      const removed = removedMarkers[ri];

      for (let ai = 0; ai < addedMarkers.length; ai++) {
        if (matchedAddedIndices.has(ai)) continue;

        const added = addedMarkers[ai];

        // Check if this is a movement (same type and similar content)
        if (this.isMarkerMovement(removed, added)) {
          movedMarkers.push({ removed, added });
          matchedAddedIndices.add(ai);
          matchedRemovedIndices.add(ri);
          break; // Each removed marker can only match one added marker
        }
      }
    }

    // Collect purely added markers (not matched as movements)
    const purelyAddedMarkers = addedMarkers.filter((_, i) => !matchedAddedIndices.has(i));

    // Collect purely removed markers (not matched as movements)
    const purelyRemovedMarkers = removedMarkers.filter((_, i) => !matchedRemovedIndices.has(i));

    return { movedMarkers, purelyAddedMarkers, purelyRemovedMarkers };
  }

  /**
   * Check if two markers represent a movement (same marker moved to different location)
   *
   * @param removed - The removed marker
   * @param added - The added marker
   * @returns True if the markers represent a movement
   */
  private isMarkerMovement(removed: ScannedDebtMarker, added: ScannedDebtMarker): boolean {
    // Must be same marker type
    if (removed.markerType !== added.markerType) {
      return false;
    }

    // If content is identical, it's definitely a movement
    if (removed.content === added.content) {
      return true;
    }

    // Use fuzzy matching for similar content
    // Normalize content for comparison
    const normalizedRemoved = this.normalizeContent(removed.content);
    const normalizedAdded = this.normalizeContent(added.content);

    // Check if content is similar (at least 80% match)
    const similarity = this.calculateSimilarity(normalizedRemoved, normalizedAdded);
    return similarity >= 0.8;
  }

  /**
   * Normalize content for comparison
   */
  private normalizeContent(content: string): string {
    return content.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  /**
   * Calculate similarity between two strings (simple Jaccard similarity)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1;
    if (!str1 || !str2) return 0;

    const words1 = new Set(str1.split(' '));
    const words2 = new Set(str2.split(' '));

    const intersection = new Set([...words1].filter((x) => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * Handle marker movement by updating the existing debt item's location
   *
   * @param repositoryId - The repository ID
   * @param removed - The removed marker
   * @param added - The added marker (new location)
   * @returns The updated debt item or null if no match found
   */
  private async handleMarkerMovement(
    repositoryId: string,
    removed: ScannedDebtMarker,
    added: ScannedDebtMarker,
  ): Promise<DebtItem | null> {
    // Find the existing debt item that matches the removed marker
    const where: {
      repositoryId: string;
      filePath: string;
      markerType: DebtMarker;
      isResolved: boolean;
      content?: { contains: string };
    } = {
      repositoryId,
      filePath: removed.filePath,
      markerType: removed.markerType,
      isResolved: false,
    };

    if (removed.content && removed.content !== `${removed.markerType} marker`) {
      where.content = { contains: removed.content.substring(0, 50) };
    }

    const existingDebt = await this.prisma.debtItem.findFirst({
      where,
      orderBy: { createdAt: 'asc' },
    });

    if (existingDebt) {
      // Update the location instead of creating a new item
      const updated = await this.prisma.debtItem.update({
        where: { id: existingDebt.id },
        data: {
          filePath: added.filePath,
          lineNumber: added.lineNumber,
          content: added.content, // Update content in case it changed slightly
        },
      });

      return updated;
    }

    return null;
  }

  /**
   * Try to resolve a matching debt item when a marker is removed
   *
   * This method tracks the resolver from the commit author and records
   * the resolution timestamp for time-to-resolution metrics.
   *
   * @param repositoryId - The repository ID
   * @param filePath - The file path
   * @param markerType - The marker type
   * @param content - The marker content
   * @param resolverId - The resolver ID (from commit author attribution)
   * @param commitId - The resolving commit ID
   * @returns The resolved debt item or null if no match found
   */
  async resolveMatchingDebt(
    repositoryId: string,
    filePath: string,
    markerType: DebtMarker,
    content: string,
    resolverId: string | null,
    commitId: string,
  ): Promise<DebtItem | null> {
    // Find matching unresolved debt item
    // Match by file path and marker type, with optional content matching
    const where: {
      repositoryId: string;
      filePath: string;
      markerType: DebtMarker;
      isResolved: boolean;
      content?: { contains: string };
    } = {
      repositoryId,
      filePath,
      markerType,
      isResolved: false,
    };

    if (content && content !== `${markerType} marker`) {
      where.content = { contains: content.substring(0, 50) };
    }

    const matchingDebt = await this.prisma.debtItem.findFirst({
      where,
      orderBy: { createdAt: 'asc' }, // Resolve oldest first (FIFO)
    });

    if (matchingDebt) {
      const resolvedAt = new Date();

      const resolvedDebt = await this.prisma.debtItem.update({
        where: { id: matchingDebt.id },
        data: {
          isResolved: true,
          resolvedAt,
          resolverId, // Track resolver from commit author
          resolvedCommitId: commitId,
        },
      });

      // Calculate and log time-to-resolution
      const timeToResolution = resolvedAt.getTime() - matchingDebt.createdAt.getTime();
      const daysToResolve = Math.round(timeToResolution / (1000 * 60 * 60 * 24));

      this.logger.log(
        `Resolved debt item ${matchingDebt.id}: ${markerType} at ${filePath} ` +
          `(resolved by ${resolverId || 'unknown'} after ${daysToResolve} days)`,
      );

      return resolvedDebt;
    }

    return null;
  }
}
