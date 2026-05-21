import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { Octokit } from '@octokit/rest';
import { PrismaService } from '../../prisma';
import { DataFilterService } from '../auth/services/data-filter.service';
import { EncryptionService } from './services/encryption.service';
import { EnableRepoDto } from './dto';
import { randomBytes } from 'crypto';
import { Role } from '@prisma/client';

/**
 * Interface for BackfillService to avoid circular dependency
 */
export interface IBackfillService {
  backfillRepository(
    repositoryId: string,
    days?: number,
  ): Promise<{
    commitsQueued: number;
    startDate: Date;
    endDate: Date;
  }>;
}

/**
 * Required GitHub PAT scopes for SQDIS integration
 * Note: admin:org is a superset of read:org, so we accept either
 */
const REQUIRED_SCOPES = ['repo', 'read:org', 'admin:repo_hook'];

/**
 * Scope hierarchy - maps required scopes to acceptable alternatives
 * admin:* scopes include read:* and write:* permissions
 */
const SCOPE_ALTERNATIVES: Record<string, string[]> = {
  'read:org': ['admin:org', 'write:org'],
  'read:repo_hook': ['admin:repo_hook', 'write:repo_hook'],
};

/**
 * Webhook secret length in bytes (32 bytes = 256 bits for HMAC-SHA256)
 */
const WEBHOOK_SECRET_LENGTH = 32;

/**
 * Response type for GitHub connection
 */
export interface GitHubConnectionResponse {
  id: string;
  organizationId: string;
  scopes: string[];
  connectedAt: Date;
}

/**
 * Response type for repository
 */
export interface RepositoryResponse {
  id: string;
  githubId: number;
  name: string;
  fullName: string;
  isEnabled: boolean;
  lastSyncAt: Date | null;
}

/**
 * Response type for connection status
 */
export interface ConnectionStatusResponse {
  isConnected: boolean;
  scopes: string[];
  connectedAt: Date | null;
  enabledRepositoriesCount: number;
}

@Injectable()
export class GitHubService {
  private readonly logger = new Logger(GitHubService.name);
  private backfillService: IBackfillService | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
    private readonly dataFilterService: DataFilterService,
  ) {}

  /**
   * Set the backfill service (called by module to avoid circular dependency)
   */
  setBackfillService(backfillService: IBackfillService): void {
    this.backfillService = backfillService;
  }

  /**
   * Create an Octokit instance with the given PAT
   */
  private createOctokit(pat: string): Octokit {
    return new Octokit({
      auth: pat,
      userAgent: 'SQDIS/1.0',
    });
  }

  /**
   * Check if a required scope is satisfied by the available scopes
   * Handles scope hierarchies (e.g., admin:org satisfies read:org)
   */
  private hasScope(requiredScope: string, availableScopes: string[]): boolean {
    // Direct match
    if (availableScopes.includes(requiredScope)) {
      return true;
    }

    // Check if any scope starts with the required scope (e.g., repo:status matches repo)
    if (availableScopes.some((scope) => scope.startsWith(`${requiredScope}:`))) {
      return true;
    }

    // Check alternative scopes (e.g., admin:org satisfies read:org)
    const alternatives = SCOPE_ALTERNATIVES[requiredScope];
    if (alternatives) {
      return alternatives.some((alt) => availableScopes.includes(alt));
    }

    return false;
  }

  /**
   * Validate GitHub PAT and check required scopes
   */
  async validatePAT(pat: string): Promise<{ valid: boolean; scopes: string[] }> {
    try {
      const octokit = this.createOctokit(pat);
      const response = await octokit.rest.users.getAuthenticated();

      const scopesHeader = (response.headers['x-oauth-scopes'] as string) || '';
      const scopes = scopesHeader
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const hasRequiredScopes = REQUIRED_SCOPES.every((required) =>
        this.hasScope(required, scopes),
      );

      this.logger.debug(`PAT validation: user=${response.data.login}, scopes=${scopes.join(',')}`);
      return { valid: hasRequiredScopes, scopes };
    } catch (error) {
      this.logger.warn(`PAT validation failed: ${error}`);
      return { valid: false, scopes: [] };
    }
  }

  /**
   * Connect GitHub PAT to organization
   */
  async connectAccount(organizationId: string, pat: string): Promise<GitHubConnectionResponse> {
    const { valid, scopes } = await this.validatePAT(pat);

    if (!valid) {
      throw new BadRequestException(
        `Invalid PAT or missing required scopes. Required scopes: ${REQUIRED_SCOPES.join(', ')}`,
      );
    }

    const existingConnection = await this.prisma.gitHubConnection.findUnique({
      where: { organizationId },
    });

    const encryptedPAT = this.encryptionService.encrypt(pat);

    if (existingConnection) {
      const connection = await this.prisma.gitHubConnection.update({
        where: { organizationId },
        data: { encryptedPAT, scopes, connectedAt: new Date() },
      });
      return this.mapConnectionToResponse(connection);
    }

    const connection = await this.prisma.gitHubConnection.create({
      data: { organizationId, encryptedPAT, scopes },
    });
    return this.mapConnectionToResponse(connection);
  }

  /**
   * Disconnect GitHub from organization
   */
  async disconnectAccount(organizationId: string): Promise<void> {
    const connection = await this.prisma.gitHubConnection.findUnique({
      where: { organizationId },
    });

    if (!connection) {
      throw new NotFoundException('No GitHub connection found for this organization');
    }

    const repositories = await this.prisma.repository.findMany({
      where: { organizationId, webhookId: { not: null } },
    });

    const pat = this.encryptionService.decrypt(connection.encryptedPAT);
    const octokit = this.createOctokit(pat);

    for (const repo of repositories) {
      if (repo.webhookId) {
        try {
          await this.removeWebhook(octokit, repo.fullName, repo.webhookId);
        } catch {
          this.logger.warn(`Failed to remove webhook ${repo.webhookId} from ${repo.fullName}`);
        }
      }
    }

    await this.prisma.$transaction([
      this.prisma.repository.deleteMany({ where: { organizationId } }),
      this.prisma.gitHubConnection.delete({ where: { organizationId } }),
    ]);
  }

  /**
   * Remove webhook from GitHub repository using Octokit
   */
  private async removeWebhook(
    octokit: Octokit,
    fullName: string,
    webhookId: number,
  ): Promise<void> {
    const [owner, repo] = fullName.split('/');

    try {
      await octokit.rest.repos.deleteWebhook({ owner, repo, hook_id: webhookId });
      this.logger.debug(`Removed webhook ${webhookId} from ${fullName}`);
    } catch (error: unknown) {
      if ((error as { status?: number }).status !== 404) {
        throw error;
      }
    }
  }

  /**
   * Update webhook secret on GitHub repository using Octokit
   */
  private async updateWebhookOnGitHub(
    octokit: Octokit,
    fullName: string,
    webhookId: number,
    secret: string,
  ): Promise<void> {
    const [owner, repo] = fullName.split('/');
    const webhookUrl = this.getWebhookUrl();

    try {
      await octokit.rest.repos.updateWebhook({
        owner,
        repo,
        hook_id: webhookId,
        active: true,
        events: ['push', 'pull_request', 'pull_request_review', 'pull_request_review_comment'],
        config: { url: webhookUrl, content_type: 'json', secret, insecure_ssl: '0' },
      });
      this.logger.debug(`Updated webhook secret for ${fullName}`);
    } catch (error: unknown) {
      const err = error as { status?: number; message?: string };
      this.logger.error(`Failed to update webhook secret for ${fullName}: ${err.message}`);
      throw error;
    }
  }

  /**
   * List available repositories from GitHub using Octokit pagination
   */
  async listRepositories(organizationId: string): Promise<RepositoryResponse[]> {
    const connection = await this.getConnection(organizationId);
    const pat = this.encryptionService.decrypt(connection.encryptedPAT);
    const octokit = this.createOctokit(pat);

    const repos = await octokit.paginate(octokit.rest.repos.listForAuthenticatedUser, {
      sort: 'updated',
      per_page: 100,
    });

    const existingRepos = await this.prisma.repository.findMany({
      where: { organizationId, githubId: { in: repos.map((r) => r.id) } },
    });

    const existingRepoMap = new Map(existingRepos.map((r) => [r.githubId, r]));

    return repos.map((repo) => {
      const existingRepo = existingRepoMap.get(repo.id);
      return {
        id: existingRepo?.id || '',
        githubId: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        isEnabled: existingRepo?.isEnabled || false,
        lastSyncAt: existingRepo?.lastSyncAt || null,
      };
    });
  }

  /**
   * Enable repository tracking with webhook configuration
   */
  async enableRepository(
    organizationId: string,
    repoId: string,
    dto: EnableRepoDto,
  ): Promise<RepositoryResponse> {
    this.logger.debug(
      `enableRepository called with organizationId=${organizationId}, repoId=${repoId}`,
    );

    // List all GitHub connections for debugging
    const allConnections = await this.prisma.gitHubConnection.findMany({
      select: { id: true, organizationId: true, connectedAt: true },
    });
    this.logger.debug(`All GitHub connections in database: ${JSON.stringify(allConnections)}`);

    const connection = await this.getConnection(organizationId);
    const pat = this.encryptionService.decrypt(connection.encryptedPAT);
    const octokit = this.createOctokit(pat);

    let repository = await this.prisma.repository.findFirst({
      where: { organizationId, OR: [{ id: repoId }, { githubId: parseInt(repoId, 10) || 0 }] },
    });

    const webhookSecret = this.generateWebhookSecret();
    const webhookId = await this.configureWebhook(octokit, dto.fullName, webhookSecret);

    if (!repository) {
      repository = await this.prisma.repository.create({
        data: {
          organizationId,
          githubId: dto.githubId,
          name: dto.name,
          fullName: dto.fullName,
          isEnabled: true,
          webhookId,
          webhookSecret,
        },
      });
    } else {
      if (repository.webhookId) {
        try {
          await this.removeWebhook(octokit, repository.fullName, repository.webhookId);
        } catch {
          this.logger.warn(
            `Failed to remove existing webhook ${repository.webhookId} from ${repository.fullName}`,
          );
        }
      }

      repository = await this.prisma.repository.update({
        where: { id: repository.id },
        data: { isEnabled: true, webhookId, webhookSecret },
      });
    }

    // Trigger backfill for last 90 days of commits asynchronously
    this.triggerBackfill(repository.id);

    return this.mapRepositoryToResponse(repository);
  }

  /**
   * Trigger backfill for a repository asynchronously
   */
  private triggerBackfill(repositoryId: string): void {
    if (!this.backfillService) {
      this.logger.warn('BackfillService not available, skipping backfill');
      return;
    }

    // Run backfill asynchronously without blocking the response
    this.backfillService
      .backfillRepository(repositoryId)
      .then((result) => {
        this.logger.log(
          `Backfill completed for repository ${repositoryId}: ${result.commitsQueued} commits queued`,
        );
      })
      .catch((error) => {
        this.logger.error(`Backfill failed for repository ${repositoryId}: ${error}`);
      });
  }

  /**
   * Generate a secure webhook secret for HMAC-SHA256 verification
   */
  generateWebhookSecret(): string {
    return randomBytes(WEBHOOK_SECRET_LENGTH).toString('hex');
  }

  /**
   * Configure webhook on GitHub repository using Octokit
   * Checks for existing webhooks and updates them instead of failing
   */
  async configureWebhook(octokit: Octokit, fullName: string, secret: string): Promise<number> {
    const webhookUrl = this.getWebhookUrl();
    const [owner, repo] = fullName.split('/');

    try {
      // First, check if a webhook with this URL already exists
      const { data: existingHooks } = await octokit.rest.repos.listWebhooks({ owner, repo });
      const existingHook = existingHooks.find((hook) => hook.config?.url === webhookUrl);

      if (existingHook) {
        // Update the existing webhook with new secret
        await octokit.rest.repos.updateWebhook({
          owner,
          repo,
          hook_id: existingHook.id,
          active: true,
          events: ['push', 'pull_request', 'pull_request_review', 'pull_request_review_comment'],
          config: { url: webhookUrl, content_type: 'json', secret, insecure_ssl: '0' },
        });
        this.logger.log(`Updated existing webhook ${existingHook.id} for ${fullName}`);
        return existingHook.id;
      }

      // Create new webhook if none exists
      const response = await octokit.rest.repos.createWebhook({
        owner,
        repo,
        name: 'web',
        active: true,
        events: ['push', 'pull_request', 'pull_request_review', 'pull_request_review_comment'],
        config: { url: webhookUrl, content_type: 'json', secret, insecure_ssl: '0' },
      });

      this.logger.log(`Created webhook ${response.data.id} for ${fullName}`);
      return response.data.id;
    } catch (error: unknown) {
      const err = error as { status?: number; message?: string };
      this.logger.error(`Failed to configure webhook for ${fullName}: ${err.message}`);

      if (err.status === 422) {
        throw new BadRequestException(
          'Failed to create webhook. A webhook for this URL may already exist on this repository.',
        );
      }

      throw new InternalServerErrorException(
        `Failed to configure webhook on GitHub: ${err.message}`,
      );
    }
  }

  private getWebhookUrl(): string {
    const baseUrl = process.env.WEBHOOK_BASE_URL || process.env.APP_URL || 'http://localhost:3000';
    return `${baseUrl}/api/github/webhook`;
  }

  /**
   * Disable repository tracking and remove webhook
   */
  async disableRepository(organizationId: string, repoId: string): Promise<void> {
    const repository = await this.prisma.repository.findFirst({
      where: { organizationId, OR: [{ id: repoId }, { githubId: parseInt(repoId, 10) || 0 }] },
    });

    if (!repository) {
      throw new NotFoundException('Repository not found');
    }

    if (repository.webhookId) {
      const connection = await this.prisma.gitHubConnection.findUnique({
        where: { organizationId },
      });

      if (connection) {
        const pat = this.encryptionService.decrypt(connection.encryptedPAT);
        const octokit = this.createOctokit(pat);
        try {
          await this.removeWebhook(octokit, repository.fullName, repository.webhookId);
        } catch (error) {
          this.logger.warn(
            `Failed to remove webhook ${repository.webhookId} from ${repository.fullName}:`,
            error,
          );
        }
      }
    }

    await this.prisma.repository.update({
      where: { id: repository.id },
      data: { isEnabled: false, webhookId: null, webhookSecret: null },
    });
  }

  /**
   * Update webhook secret for repository
   */
  async updateWebhookSecret(
    organizationId: string,
    repoId: string,
    webhookSecret: string,
  ): Promise<{ id: string; name: string; fullName: string; message: string }> {
    // Find repository and verify it belongs to the organization
    const repository = await this.prisma.repository.findFirst({
      where: { organizationId, OR: [{ id: repoId }, { githubId: parseInt(repoId, 10) || 0 }] },
    });

    if (!repository) {
      throw new NotFoundException('Repository not found');
    }

    // Update the webhook secret in the database
    await this.prisma.repository.update({
      where: { id: repository.id },
      data: { webhookSecret },
    });

    // If the repository has a webhook configured on GitHub, update it there too
    if (repository.webhookId && repository.isEnabled) {
      const connection = await this.prisma.gitHubConnection.findUnique({
        where: { organizationId },
      });

      if (connection) {
        const pat = this.encryptionService.decrypt(connection.encryptedPAT);
        const octokit = this.createOctokit(pat);

        try {
          // Update the webhook secret on GitHub
          await this.updateWebhookOnGitHub(
            octokit,
            repository.fullName,
            repository.webhookId,
            webhookSecret,
          );
          this.logger.log(`Updated webhook secret on GitHub for repository ${repository.fullName}`);
        } catch (error) {
          this.logger.warn(
            `Failed to update webhook secret on GitHub for ${repository.fullName}:`,
            error,
          );
          // Don't throw - the database update succeeded, which is the critical part
        }
      }
    }

    return {
      id: repository.id,
      name: repository.name,
      fullName: repository.fullName,
      message: 'Webhook secret updated successfully',
    };
  }

  /**
   * Get GitHub connection status
   */
  async getConnectionStatus(organizationId: string): Promise<ConnectionStatusResponse> {
    const connection = await this.prisma.gitHubConnection.findUnique({
      where: { organizationId },
    });

    if (!connection) {
      return { isConnected: false, scopes: [], connectedAt: null, enabledRepositoriesCount: 0 };
    }

    const enabledReposCount = await this.prisma.repository.count({
      where: { organizationId, isEnabled: true },
    });

    return {
      isConnected: true,
      scopes: connection.scopes,
      connectedAt: connection.connectedAt,
      enabledRepositoriesCount: enabledReposCount,
    };
  }

  /**
   * Get decrypted PAT for a connection
   */
  async getDecryptedPAT(organizationId: string): Promise<string> {
    const connection = await this.getConnection(organizationId);
    return this.encryptionService.decrypt(connection.encryptedPAT);
  }

  /**
   * Get an Octokit instance for an organization
   */
  async getOctokitForOrganization(organizationId: string): Promise<Octokit> {
    const pat = await this.getDecryptedPAT(organizationId);
    return this.createOctokit(pat);
  }

  private async getConnection(organizationId: string) {
    this.logger.debug(`Looking for GitHub connection for organization: ${organizationId}`);

    const connection = await this.prisma.gitHubConnection.findUnique({
      where: { organizationId },
    });

    if (!connection) {
      this.logger.warn(`No GitHub connection found for organization: ${organizationId}`);
      throw new NotFoundException(
        `No GitHub connection found for this organization. Please connect GitHub in Settings > GitHub first.`,
      );
    }

    return connection;
  }

  private mapConnectionToResponse(connection: {
    id: string;
    organizationId: string;
    scopes: string[];
    connectedAt: Date;
  }): GitHubConnectionResponse {
    return {
      id: connection.id,
      organizationId: connection.organizationId,
      scopes: connection.scopes,
      connectedAt: connection.connectedAt,
    };
  }

  private mapRepositoryToResponse(repository: {
    id: string;
    githubId: number;
    name: string;
    fullName: string;
    isEnabled: boolean;
    lastSyncAt: Date | null;
  }): RepositoryResponse {
    return {
      id: repository.id,
      githubId: repository.githubId,
      name: repository.name,
      fullName: repository.fullName,
      isEnabled: repository.isEnabled,
      lastSyncAt: repository.lastSyncAt,
    };
  }

  /**
   * Update webhooks for all enabled repositories in an organization
   * This is useful when the WEBHOOK_BASE_URL changes (e.g., new ngrok URL)
   */
  async updateAllWebhooks(
    organizationId: string,
  ): Promise<{ updated: number; failed: number; errors: string[] }> {
    const connection = await this.getConnection(organizationId);
    const pat = this.encryptionService.decrypt(connection.encryptedPAT);
    const octokit = this.createOctokit(pat);

    const repositories = await this.prisma.repository.findMany({
      where: { organizationId, isEnabled: true },
    });

    let updated = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const repo of repositories) {
      try {
        // Generate new webhook secret
        const webhookSecret = this.generateWebhookSecret();

        // Update webhook on GitHub
        const webhookId = await this.configureWebhook(octokit, repo.fullName, webhookSecret);

        // Update repository in database
        await this.prisma.repository.update({
          where: { id: repo.id },
          data: { webhookId, webhookSecret },
        });

        this.logger.log(`Updated webhook for ${repo.fullName}`);
        updated++;
      } catch (error) {
        const errorMsg = `Failed to update webhook for ${repo.fullName}: ${error}`;
        this.logger.error(errorMsg);
        errors.push(errorMsg);
        failed++;
      }
    }

    return { updated, failed, errors };
  }

  /**
   * Get a single repository by ID
   */
  async getRepository(repositoryId: string) {
    return this.prisma.repository.findUnique({
      where: { id: repositoryId },
      select: {
        id: true,
        organizationId: true,
        githubId: true,
        name: true,
        fullName: true,
        isEnabled: true,
        lastSyncAt: true,
      },
    });
  }

  /**
   * Get all repositories for an organization with role-based filtering
   */
  async getRepositoriesByOrganization(organizationId: string, userId: string, userRole: Role) {
    // Apply role-based filtering using DataFilterService
    const filter = await this.dataFilterService.createRepositoryFilter(
      userId,
      userRole,
      organizationId,
    );

    return this.prisma.repository.findMany({
      where: filter,
      select: {
        id: true,
        organizationId: true,
        githubId: true,
        name: true,
        fullName: true,
        isEnabled: true,
        lastSyncAt: true,
      },
    });
  }

  /**
   * Update webhook enabled status for a repository
   */
  async updateWebhookEnabled(
    organizationId: string,
    repoId: string,
    enabled: boolean,
  ): Promise<{ id: string; name: string; fullName: string; isEnabled: boolean; message: string }> {
    // Find repository and verify it belongs to the organization
    const repository = await this.prisma.repository.findFirst({
      where: { organizationId, OR: [{ id: repoId }, { githubId: parseInt(repoId, 10) || 0 }] },
    });

    if (!repository) {
      throw new NotFoundException('Repository not found');
    }

    // Update the webhook enabled status
    const updatedRepository = await this.prisma.repository.update({
      where: { id: repository.id },
      data: { isEnabled: enabled },
    });

    return {
      id: updatedRepository.id,
      name: updatedRepository.name,
      fullName: updatedRepository.fullName,
      isEnabled: updatedRepository.isEnabled,
      message: `Webhook processing ${enabled ? 'enabled' : 'disabled'} successfully`,
    };
  }

  /**
   * Test webhook connectivity by sending a ping
   */
  async testWebhookConnectivity(
    organizationId: string,
    repoId: string,
  ): Promise<{ success: boolean; message: string; repositoryName: string }> {
    // Find repository and verify it belongs to the organization
    const repository = await this.prisma.repository.findFirst({
      where: { organizationId, OR: [{ id: repoId }, { githubId: parseInt(repoId, 10) || 0 }] },
    });

    if (!repository) {
      throw new NotFoundException('Repository not found');
    }

    if (!repository.webhookId) {
      throw new BadRequestException('Repository does not have a webhook configured');
    }

    // Get Octokit instance for the organization
    const octokit = await this.getOctokitForOrganization(organizationId);
    const [owner, repo] = repository.fullName.split('/');

    try {
      // Ping the webhook using GitHub API
      await octokit.rest.repos.pingWebhook({
        owner,
        repo,
        hook_id: repository.webhookId,
      });

      this.logger.log(`Successfully pinged webhook for repository ${repository.fullName}`);

      return {
        success: true,
        message: 'Webhook ping sent successfully. Check webhook logs for delivery status.',
        repositoryName: repository.fullName,
      };
    } catch (error: unknown) {
      const err = error as { status?: number; message?: string };
      this.logger.error(`Failed to ping webhook for ${repository.fullName}: ${err.message}`);

      if (err.status === 404) {
        throw new NotFoundException(
          'Webhook not found on GitHub. It may have been deleted. Try re-enabling the repository.',
        );
      }

      throw new InternalServerErrorException(`Failed to ping webhook: ${err.message}`);
    }
  }
}
