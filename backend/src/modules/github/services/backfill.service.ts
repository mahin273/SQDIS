import { Injectable, Logger } from '@nestjs/common';
import { Octokit } from '@octokit/rest';
import { PrismaService } from '../../../prisma';
import { GitHubService } from '../github.service';
import { GitHubApiService } from './github-api.service';
import { CommitProcessorQueue } from '../queues/commit-processor.queue';
import { ParsedCommitData } from '../dto/webhook-payload.dto';

/**
 * Default backfill period in days
 */
const DEFAULT_BACKFILL_DAYS = 90;

/**
 * Batch size for processing commits
 */
const COMMIT_BATCH_SIZE = 100;

/**
 * Service for backfilling historical commits from GitHub
 */
@Injectable()
export class BackfillService {
  private readonly logger = new Logger(BackfillService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly githubService: GitHubService,
    private readonly githubApiService: GitHubApiService,
    private readonly commitProcessorQueue: CommitProcessorQueue,
  ) {}

  /**
   * Backfill commits for a repository for the last N days
   *
   * @param repositoryId - Internal repository ID
   * @param days - Number of days to backfill (default: 90)
   * @returns Number of commits queued for processing
   */
  async backfillRepository(
    repositoryId: string,
    days: number = DEFAULT_BACKFILL_DAYS,
  ): Promise<{ commitsQueued: number; startDate: Date; endDate: Date }> {
    this.logger.log(`Starting backfill for repository ${repositoryId} (last ${days} days)`);

    const repository = await this.prisma.repository.findUnique({
      where: { id: repositoryId },
      include: { organization: true },
    });

    if (!repository) {
      throw new Error(`Repository ${repositoryId} not found`);
    }

    const octokit = await this.githubService.getOctokitForOrganization(repository.organizationId);

    const [owner, repo] = repository.fullName.split('/');
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    this.logger.log(
      `Fetching commits for ${repository.fullName} from ${startDate.toISOString()} to ${endDate.toISOString()}`,
    );

    // Fetch all commit SHAs using pagination
    const commitShas = await this.fetchCommitShasWithPagination(
      octokit,
      owner,
      repo,
      startDate,
      endDate,
    );

    this.logger.log(`Found ${commitShas.length} commits to backfill for ${repository.fullName}`);

    // Filter out commits that already exist in the database
    const existingCommits = await this.prisma.commit.findMany({
      where: {
        repositoryId,
        sha: { in: commitShas },
      },
      select: { sha: true },
    });

    const existingShas = new Set(existingCommits.map((c) => c.sha));
    const newCommitShas = commitShas.filter((sha) => !existingShas.has(sha));

    this.logger.log(
      `${newCommitShas.length} new commits to process (${existingShas.size} already exist)`,
    );

    // Process commits in batches
    let commitsQueued = 0;
    for (let i = 0; i < newCommitShas.length; i += COMMIT_BATCH_SIZE) {
      const batch = newCommitShas.slice(i, i + COMMIT_BATCH_SIZE);
      const queuedCount = await this.processCommitBatch(
        octokit,
        owner,
        repo,
        batch,
        repositoryId,
        repository.organizationId,
        repository.fullName,
      );
      commitsQueued += queuedCount;

      this.logger.debug(
        `Processed batch ${Math.floor(i / COMMIT_BATCH_SIZE) + 1}: ${queuedCount} commits queued`,
      );
    }

    // Update repository last sync time
    await this.prisma.repository.update({
      where: { id: repositoryId },
      data: { lastSyncAt: new Date() },
    });

    this.logger.log(
      `Backfill complete for ${repository.fullName}: ${commitsQueued} commits queued`,
    );

    return { commitsQueued, startDate, endDate };
  }

  /**
   * Fetch commit SHAs with pagination support
   *
   * @param octokit - Authenticated Octokit instance
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param since - Start date
   * @param until - End date
   * @returns Array of commit SHAs
   */
  private async fetchCommitShasWithPagination(
    octokit: Octokit,
    owner: string,
    repo: string,
    since: Date,
    until: Date,
  ): Promise<string[]> {
    this.logger.debug(`Fetching commits with pagination for ${owner}/${repo}`);

    try {
      // Use Octokit's built-in pagination
      const commits = await octokit.paginate(octokit.rest.repos.listCommits, {
        owner,
        repo,
        since: since.toISOString(),
        until: until.toISOString(),
        per_page: 100,
      });

      return commits.map((commit) => commit.sha);
    } catch (error) {
      this.logger.error(`Failed to fetch commits with pagination: ${error}`);
      throw error;
    }
  }

  /**
   * Process a batch of commits by fetching details and queueing for processing
   *
   * @param octokit - Authenticated Octokit instance
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param shas - Array of commit SHAs to process
   * @param repositoryId - Internal repository ID
   * @param organizationId - Organization ID
   * @param repositoryFullName - Full repository name (owner/repo)
   * @returns Number of commits successfully queued
   */
  private async processCommitBatch(
    octokit: Octokit,
    owner: string,
    repo: string,
    shas: string[],
    repositoryId: string,
    organizationId: string,
    repositoryFullName: string,
  ): Promise<number> {
    let queuedCount = 0;

    for (const sha of shas) {
      try {
        const commitDetail = await this.githubApiService.fetchCommitDetails(
          octokit,
          owner,
          repo,
          sha,
        );

        const parsedCommit: ParsedCommitData = {
          sha: commitDetail.sha,
          message: commitDetail.commit.message,
          timestamp: new Date(commitDetail.commit.author.date),
          authorName: commitDetail.commit.author.name,
          authorEmail: commitDetail.commit.author.email,
          committerName: commitDetail.commit.committer.name,
          committerEmail: commitDetail.commit.committer.email,
          filesAdded: commitDetail.files.filter((f) => f.status === 'added').map((f) => f.filename),
          filesRemoved: commitDetail.files
            .filter((f) => f.status === 'removed')
            .map((f) => f.filename),
          filesModified: commitDetail.files
            .filter((f) => f.status === 'modified' || f.status === 'changed')
            .map((f) => f.filename),
          repositoryId: 0, // Will be set by the queue processor
          repositoryFullName,
          forced: false,
        };

        await this.commitProcessorQueue.addCommitJob(parsedCommit, repositoryId, organizationId);

        queuedCount++;
      } catch (error) {
        this.logger.warn(`Failed to process commit ${sha}: ${error}`);
        // Continue with other commits even if one fails
      }
    }

    return queuedCount;
  }

  /**
   * Get backfill status for a repository
   *
   * @param repositoryId - Internal repository ID
   * @returns Backfill status information
   */
  async getBackfillStatus(repositoryId: string): Promise<{
    lastSyncAt: Date | null;
    totalCommits: number;
    oldestCommit: Date | null;
    newestCommit: Date | null;
  }> {
    const repository = await this.prisma.repository.findUnique({
      where: { id: repositoryId },
    });

    if (!repository) {
      throw new Error(`Repository ${repositoryId} not found`);
    }

    const commitCount = await this.prisma.commit.count({
      where: { repositoryId },
    });

    const oldestCommit = await this.prisma.commit.findFirst({
      where: { repositoryId },
      orderBy: { committedAt: 'asc' },
      select: { committedAt: true },
    });

    const newestCommit = await this.prisma.commit.findFirst({
      where: { repositoryId },
      orderBy: { committedAt: 'desc' },
      select: { committedAt: true },
    });

    return {
      lastSyncAt: repository.lastSyncAt,
      totalCommits: commitCount,
      oldestCommit: oldestCommit?.committedAt || null,
      newestCommit: newestCommit?.committedAt || null,
    };
  }
}
