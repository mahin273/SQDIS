import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Octokit } from '@octokit/rest';
import { PrismaService } from '../../../prisma';
import { GitHubService } from '../github.service';
import { GitHubApiService } from './github-api.service';
import { CommitProcessorQueue } from '../queues/commit-processor.queue';
import { ParsedCommitData } from '../dto/webhook-payload.dto';

/**
 * Batch size for processing commits during polling
 */
const POLLING_BATCH_SIZE = 100;

/**
 * Default hours to look back if no lastSyncAt is set
 */
const DEFAULT_LOOKBACK_HOURS = 2;

/**
 * Service for hourly polling of GitHub commits
 */
@Injectable()
export class PollingService {
  private readonly logger = new Logger(PollingService.name);
  private isPolling = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly githubService: GitHubService,
    private readonly githubApiService: GitHubApiService,
    private readonly commitProcessorQueue: CommitProcessorQueue,
  ) {}

  /**
   * Hourly cron job to poll for missed commits
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleHourlyPolling(): Promise<void> {
    if (this.isPolling) {
      this.logger.warn('Polling already in progress, skipping this cycle');
      return;
    }

    this.isPolling = true;
    this.logger.log('Starting hourly commit polling');

    try {
      const enabledRepositories = await this.getEnabledRepositories();
      this.logger.log(`Found ${enabledRepositories.length} enabled repositories to poll`);

      let totalCommitsQueued = 0;

      for (const repository of enabledRepositories) {
        try {
          const commitsQueued = await this.pollRepository(repository);
          totalCommitsQueued += commitsQueued;
        } catch (error) {
          this.logger.error(`Failed to poll repository ${repository.fullName}: ${error}`);
          // Continue with other repositories even if one fails
        }
      }

      this.logger.log(
        `Hourly polling complete: ${totalCommitsQueued} commits queued from ${enabledRepositories.length} repositories`,
      );
    } catch (error) {
      this.logger.error(`Hourly polling failed: ${error}`);
    } finally {
      this.isPolling = false;
    }
  }

  /**
   * Poll a single repository for commits since last sync
   *
   * @param repository - Repository to poll
   * @returns Number of commits queued for processing
   */
  async pollRepository(repository: {
    id: string;
    organizationId: string;
    fullName: string;
    lastSyncAt: Date | null;
  }): Promise<number> {
    this.logger.debug(`Polling repository ${repository.fullName}`);

    const octokit = await this.githubService.getOctokitForOrganization(repository.organizationId);

    const [owner, repo] = repository.fullName.split('/');

    // Determine the start time for fetching commits
    const since = this.calculateSinceDate(repository.lastSyncAt);
    const until = new Date();

    this.logger.debug(`Fetching commits for ${repository.fullName} since ${since.toISOString()}`);

    // Fetch commits since last sync
    const commitShas = await this.fetchCommitsSince(octokit, owner, repo, since, until);

    if (commitShas.length === 0) {
      this.logger.debug(`No new commits found for ${repository.fullName}`);
      await this.updateLastSyncTime(repository.id);
      return 0;
    }

    this.logger.log(
      `Found ${commitShas.length} commits for ${repository.fullName} since ${since.toISOString()}`,
    );

    // Filter out commits that already exist
    const newCommitShas = await this.filterExistingCommits(repository.id, commitShas);

    if (newCommitShas.length === 0) {
      this.logger.debug(
        `All ${commitShas.length} commits already processed for ${repository.fullName}`,
      );
      await this.updateLastSyncTime(repository.id);
      return 0;
    }

    this.logger.log(`${newCommitShas.length} new commits to process for ${repository.fullName}`);

    // Process commits in batches
    const commitsQueued = await this.processCommitBatch(
      octokit,
      owner,
      repo,
      newCommitShas,
      repository.id,
      repository.organizationId,
      repository.fullName,
    );

    // Update last sync time
    await this.updateLastSyncTime(repository.id);

    return commitsQueued;
  }

  /**
   * Get all enabled repositories for polling
   */
  private async getEnabledRepositories(): Promise<
    Array<{
      id: string;
      organizationId: string;
      fullName: string;
      lastSyncAt: Date | null;
    }>
  > {
    return this.prisma.repository.findMany({
      where: {
        isEnabled: true,
        organization: {
          githubConnections: {
            some: {
              id: { not: '' },
            },
          },
        },
      },
      select: {
        id: true,
        organizationId: true,
        fullName: true,
        lastSyncAt: true,
      },
    });
  }

  /**
   * Calculate the 'since' date for fetching commits
   * Uses lastSyncAt if available, otherwise defaults to 2 hours ago
   */
  private calculateSinceDate(lastSyncAt: Date | null): Date {
    if (lastSyncAt) {
      return lastSyncAt;
    }

    // Default to 2 hours ago if no lastSyncAt
    const since = new Date();
    since.setHours(since.getHours() - DEFAULT_LOOKBACK_HOURS);
    return since;
  }

  /**
   * Fetch commit SHAs from GitHub API since a given date
   */
  private async fetchCommitsSince(
    octokit: Octokit,
    owner: string,
    repo: string,
    since: Date,
    until: Date,
  ): Promise<string[]> {
    try {
      const commits = await octokit.paginate(octokit.rest.repos.listCommits, {
        owner,
        repo,
        since: since.toISOString(),
        until: until.toISOString(),
        per_page: 100,
      });

      return commits.map((commit) => commit.sha);
    } catch (error) {
      this.logger.error(`Failed to fetch commits for ${owner}/${repo}: ${error}`);
      throw error;
    }
  }

  /**
   * Filter out commits that already exist in the database
   */
  private async filterExistingCommits(
    repositoryId: string,
    commitShas: string[],
  ): Promise<string[]> {
    const existingCommits = await this.prisma.commit.findMany({
      where: {
        repositoryId,
        sha: { in: commitShas },
      },
      select: { sha: true },
    });

    const existingShas = new Set(existingCommits.map((c) => c.sha));
    return commitShas.filter((sha) => !existingShas.has(sha));
  }

  /**
   * Process a batch of commits by fetching details and queueing for processing
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

    for (let i = 0; i < shas.length; i += POLLING_BATCH_SIZE) {
      const batch = shas.slice(i, i + POLLING_BATCH_SIZE);

      for (const sha of batch) {
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
            filesAdded: commitDetail.files
              .filter((f) => f.status === 'added')
              .map((f) => f.filename),
            filesRemoved: commitDetail.files
              .filter((f) => f.status === 'removed')
              .map((f) => f.filename),
            filesModified: commitDetail.files
              .filter((f) => f.status === 'modified' || f.status === 'changed')
              .map((f) => f.filename),
            repositoryId: 0,
            repositoryFullName: repositoryFullName,
            forced: false,
          };

          await this.commitProcessorQueue.addCommitJob(parsedCommit, repositoryId, organizationId);

          queuedCount++;
        } catch (error) {
          this.logger.warn(`Failed to process commit ${sha}: ${error}`);
          // Continue with other commits even if one fails
        }
      }
    }

    return queuedCount;
  }

  /**
   * Update the last sync time for a repository
   */
  private async updateLastSyncTime(repositoryId: string): Promise<void> {
    await this.prisma.repository.update({
      where: { id: repositoryId },
      data: { lastSyncAt: new Date() },
    });
  }

  /**
   * Manually trigger polling for a specific repository
   * Useful for testing or on-demand sync
   */
  async triggerPollingForRepository(repositoryId: string): Promise<number> {
    const repository = await this.prisma.repository.findUnique({
      where: { id: repositoryId },
      select: {
        id: true,
        organizationId: true,
        fullName: true,
        lastSyncAt: true,
        isEnabled: true,
      },
    });

    if (!repository) {
      throw new Error(`Repository ${repositoryId} not found`);
    }

    if (!repository.isEnabled) {
      throw new Error(`Repository ${repository.fullName} is not enabled`);
    }

    return this.pollRepository(repository);
  }

  /**
   * Get polling status for monitoring
   */
  getPollingStatus(): { isPolling: boolean } {
    return { isPolling: this.isPolling };
  }
}
