import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  Headers,
  Req,
  Query,
  Logger,
  Res,
  HttpException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiHeader,
  ApiExcludeEndpoint,
  ApiQuery,
} from '@nestjs/swagger';
import { Request } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { GitHubService } from './github.service';
import { WebhookService } from './services/webhook.service';
import { BackfillService } from './services/backfill.service';
import { WebhookLogService } from './services/webhook-log.service';
import { WebhookMonitoringService } from './services/webhook-monitoring.service';
import { RateLimitService } from './services/rate-limit.service';
import { ConnectGithubDto } from './dto/connect-github.dto';
import { EnableRepoDto } from './dto/enable-repo.dto';
import { QueryWebhookLogsDto } from './dto/query-webhook-logs.dto';
import { QueryWebhookHealthDto } from './dto/query-webhook-health.dto';
import { UpdateWebhookSecretDto } from './dto/update-webhook-secret.dto';
import { UpdateWebhookEnabledDto } from './dto/update-webhook-enabled.dto';
import { TestWebhookDto } from './dto/test-webhook.dto';
import { UpdateRateLimitDto } from './dto/update-rate-limit.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { GetUser, RequestUser } from '../auth/decorators/get-user.decorator';
import { GetOrganization } from '../auth/decorators/get-organization.decorator';
import { Role } from '@prisma/client';
import { WebSocketGateway } from '../websocket/websocket.gateway';
import { AuditLog } from '../audit/decorators/audit-log.decorator';

/**
 * Controller for GitHub integration
 */
@ApiTags('GitHub')
@Controller('github')
export class GitHubController {
  private readonly logger = new Logger(GitHubController.name);

  constructor(
    private readonly githubService: GitHubService,
    private readonly webhookService: WebhookService,
    private readonly backfillService: BackfillService,
    private readonly wsGateway: WebSocketGateway,
    private readonly webhookLogService: WebhookLogService,
    private readonly webhookMonitoringService: WebhookMonitoringService,
    private readonly rateLimitService: RateLimitService,
  ) {}

  /**
   * Helper to validate organization context exists
   */
  private validateOrganizationContext(organizationId: string | undefined): string {
    if (!organizationId) {
      throw new ForbiddenException(
        'Organization context required. Please switch to an organization first.',
      );
    }
    return organizationId;
  }

  /**
   * Receive GitHub webhook events
   * This endpoint is public (no JWT auth) but verifies HMAC-SHA256 signature
   */
  @Post('webhook')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive GitHub webhook events' })
  @ApiHeader({ name: 'X-Hub-Signature-256', description: 'GitHub HMAC-SHA256 signature' })
  @ApiHeader({ name: 'X-GitHub-Event', description: 'GitHub event type' })
  @ApiHeader({ name: 'X-GitHub-Delivery', description: 'Unique delivery ID' })
  @ApiResponse({
    status: 200,
    description: 'Webhook processed successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid webhook signature',
  })
  @ApiResponse({
    status: 404,
    description: 'Repository not found or not enabled',
  })
  @ApiResponse({
    status: 429,
    description: 'Rate limit exceeded',
  })
  async receiveWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Res({ passthrough: true }) res: Response,
    @Headers('x-hub-signature-256') signature: string,
    @Headers('x-github-event') event: string,
    @Headers('x-github-delivery') deliveryId: string,
  ) {
    // Get raw body as string for signature verification
    const rawBody = req.rawBody?.toString('utf8') || JSON.stringify(req.body);

    try {
      return await this.webhookService.processWebhook(rawBody, signature, event, deliveryId);
    } catch (error) {
      // Handle rate limit exception and set Retry-After header (Requirement 13.3)
      if (error instanceof HttpException && error.getStatus() === HttpStatus.TOO_MANY_REQUESTS) {
        const response = error.getResponse() as any;
        if (response.retryAfter) {
          res.setHeader('Retry-After', response.retryAfter.toString());
        }
      }
      throw error;
    }
  }

  /**
   * Validate GitHub PAT without connecting
   */
  @Post('validate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiOperation({ summary: 'Validate GitHub PAT without connecting' })
  @ApiResponse({
    status: 200,
    description: 'PAT validation result',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions',
  })
  async validatePAT(@Body() dto: ConnectGithubDto) {
    return this.githubService.validatePAT(dto.pat);
  }

  /**
   * Connect GitHub PAT to organization
   * Only OWNER and ADMIN roles can connect GitHub
   */
  @Post('connect')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(Role.OWNER, Role.ADMIN)
  @AuditLog({
    action: 'CREATE',
    resourceType: 'GitHubConnection',
    captureSnapshot: true,
    includeRequestBody: false, // Don't log the PAT
    includeResponseBody: true,
  })
  @ApiOperation({ summary: 'Connect GitHub PAT to organization' })
  @ApiResponse({
    status: 201,
    description: 'GitHub PAT connected successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid PAT or missing required scopes',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions or missing organization context',
  })
  async connect(
    @Body() dto: ConnectGithubDto,
    @GetOrganization('id') organizationId: string | undefined,
  ) {
    const orgId = this.validateOrganizationContext(organizationId);
    return this.githubService.connectAccount(orgId, dto.pat);
  }

  /**
   * Disconnect GitHub from organization
   * Only OWNER and ADMIN roles can disconnect GitHub
   */
  @Delete('disconnect')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(Role.OWNER, Role.ADMIN)
  @AuditLog({
    action: 'DELETE',
    resourceType: 'GitHubConnection',
    captureSnapshot: true,
    includeResponseBody: true,
  })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Disconnect GitHub from organization' })
  @ApiResponse({
    status: 204,
    description: 'GitHub disconnected successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions or missing organization context',
  })
  @ApiResponse({
    status: 404,
    description: 'No GitHub connection found',
  })
  async disconnect(@GetOrganization('id') organizationId: string | undefined) {
    const orgId = this.validateOrganizationContext(organizationId);
    return this.githubService.disconnectAccount(orgId);
  }

  /**
   * List available repositories
   */
  @Get('repositories')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List available GitHub repositories' })
  @ApiResponse({
    status: 200,
    description: 'List of repositories',
  })
  @ApiResponse({
    status: 403,
    description: 'Missing organization context',
  })
  @ApiResponse({
    status: 404,
    description: 'No GitHub connection found',
  })
  async listRepositories(@GetOrganization('id') organizationId: string | undefined) {
    const orgId = this.validateOrganizationContext(organizationId);
    return this.githubService.listRepositories(orgId);
  }

  /**
   * Enable repository tracking
   * Only OWNER and ADMIN roles can enable repositories
   */
  @Post('repositories/:id/enable')
  @AuditLog({
    action: 'CREATE',
    resourceType: 'Repository',
    resourceIdParam: 'id',
    captureSnapshot: true,
    includeRequestBody: true,
    includeResponseBody: true,
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiOperation({ summary: 'Enable repository tracking' })
  @ApiParam({ name: 'id', description: 'Repository ID' })
  @ApiResponse({
    status: 201,
    description: 'Repository tracking enabled',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions or missing organization context',
  })
  @ApiResponse({
    status: 404,
    description: 'Repository not found',
  })
  async enableRepository(
    @Param('id') repoId: string,
    @GetOrganization('id') organizationId: string | undefined,
    @Body() dto: EnableRepoDto,
  ) {
    this.logger.debug(
      `Enable repository request: repoId=${repoId}, organizationId=${organizationId}, dto=${JSON.stringify(dto)}`,
    );
    const orgId = this.validateOrganizationContext(organizationId);
    this.logger.debug(`Validated organization ID: ${orgId}`);
    return this.githubService.enableRepository(orgId, repoId, dto);
  }

  /**
   * Disable repository tracking
   * Only OWNER and ADMIN roles can disable repositories
   */
  @Delete('repositories/:id/disable')
  @AuditLog({
    action: 'DELETE',
    resourceType: 'Repository',
    resourceIdParam: 'id',
    captureSnapshot: true,
    includeResponseBody: true,
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(Role.OWNER, Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Disable repository tracking' })
  @ApiParam({ name: 'id', description: 'Repository ID' })
  @ApiResponse({
    status: 204,
    description: 'Repository tracking disabled',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions or missing organization context',
  })
  @ApiResponse({
    status: 404,
    description: 'Repository not found',
  })
  async disableRepository(
    @Param('id') repoId: string,
    @GetOrganization('id') organizationId: string | undefined,
  ) {
    const orgId = this.validateOrganizationContext(organizationId);
    return this.githubService.disableRepository(orgId, repoId);
  }

  /**
   * Update webhook secret for repository
   * Only OWNER and ADMIN roles can update webhook secrets
   */
  @Put('repositories/:id/webhook-secret')
  @AuditLog({
    action: 'UPDATE',
    resourceType: 'Repository',
    resourceIdParam: 'id',
    captureSnapshot: true,
    includeRequestBody: false, // Don't log the secret
    includeResponseBody: true,
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiOperation({ summary: 'Update webhook secret for repository' })
  @ApiParam({ name: 'id', description: 'Repository ID' })
  @ApiResponse({
    status: 200,
    description: 'Webhook secret updated successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'repo-uuid-123' },
        name: { type: 'string', example: 'my-repo' },
        fullName: { type: 'string', example: 'owner/my-repo' },
        message: { type: 'string', example: 'Webhook secret updated successfully' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid webhook secret format',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions or missing organization context',
  })
  @ApiResponse({
    status: 404,
    description: 'Repository not found',
  })
  async updateWebhookSecret(
    @Param('id') repoId: string,
    @GetOrganization('id') organizationId: string | undefined,
    @Body() dto: UpdateWebhookSecretDto,
  ) {
    const orgId = this.validateOrganizationContext(organizationId);
    return this.githubService.updateWebhookSecret(orgId, repoId, dto.webhookSecret);
  }

  /**
   * Enable or disable webhook processing for repository
   * Only OWNER and ADMIN roles can update webhook status
   */
  @Put('repositories/:id/webhook-enabled')
  @AuditLog({
    action: 'UPDATE',
    resourceType: 'Repository',
    resourceIdParam: 'id',
    captureSnapshot: true,
    includeRequestBody: true,
    includeResponseBody: true,
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiOperation({ summary: 'Enable or disable webhook processing for repository' })
  @ApiParam({ name: 'id', description: 'Repository ID' })
  @ApiResponse({
    status: 200,
    description: 'Webhook processing status updated successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: 'repo-uuid-123' },
        name: { type: 'string', example: 'my-repo' },
        fullName: { type: 'string', example: 'owner/my-repo' },
        isEnabled: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Webhook processing enabled successfully' },
      },
    },
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions or missing organization context',
  })
  @ApiResponse({
    status: 404,
    description: 'Repository not found',
  })
  async updateWebhookEnabled(
    @Param('id') repoId: string,
    @GetOrganization('id') organizationId: string | undefined,
    @Body() dto: UpdateWebhookEnabledDto,
  ) {
    const orgId = this.validateOrganizationContext(organizationId);
    return this.githubService.updateWebhookEnabled(orgId, repoId, dto.enabled);
  }

  /**
   * Get GitHub connection status
   */
  @Get('status')
  @SkipThrottle()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get GitHub connection status' })
  @ApiResponse({
    status: 200,
    description: 'GitHub connection status',
  })
  @ApiResponse({
    status: 403,
    description: 'Missing organization context',
  })
  async getStatus(@GetOrganization('id') organizationId: string | undefined) {
    this.logger.debug(`Get status request: organizationId=${organizationId}`);
    const orgId = this.validateOrganizationContext(organizationId);
    this.logger.debug(`Validated organization ID for status: ${orgId}`);
    return this.githubService.getConnectionStatus(orgId);
  }

  /**
   * Update webhooks for all enabled repositories
   * Useful when WEBHOOK_BASE_URL changes (e.g., new ngrok URL)
   */
  @Post('webhooks/refresh')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiOperation({ summary: 'Refresh webhooks for all enabled repositories' })
  @ApiResponse({
    status: 200,
    description: 'Webhooks refreshed successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions or missing organization context',
  })
  async refreshWebhooks(@GetOrganization('id') organizationId: string | undefined) {
    const orgId = this.validateOrganizationContext(organizationId);
    this.logger.log(`Refreshing webhooks for organization ${orgId}`);
    return this.githubService.updateAllWebhooks(orgId);
  }

  /**
   * Test WebSocket by emitting a fake commit:new event
   * For debugging purposes only
   */
  @Post('webhooks/test')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiOperation({ summary: 'Test WebSocket by emitting a fake commit event' })
  @ApiResponse({
    status: 200,
    description: 'Test event emitted',
  })
  async testWebSocket(@GetOrganization('id') organizationId: string | undefined) {
    const orgId = this.validateOrganizationContext(organizationId);
    this.logger.log(`Emitting test WebSocket event for organization ${orgId}`);

    // Use the WebSocket gateway to emit the test event
    return this.wsGateway.emitTestCommitEvent(orgId);
  }

  /**
   * Test webhook connectivity by sending a ping
   * Only OWNER and ADMIN roles can test webhooks
   */
  @Post('webhooks/test-connectivity')
  @AuditLog({
    action: 'READ',
    resourceType: 'Repository',
    resourceIdParam: 'repositoryId',
    captureSnapshot: false,
    includeRequestBody: true,
    includeResponseBody: true,
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiOperation({
    summary: 'Test webhook connectivity by sending a ping',
    description:
      'Sends a ping event to the GitHub webhook to test connectivity. The ping event will be delivered to your webhook endpoint.',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook ping sent successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: {
          type: 'string',
          example: 'Webhook ping sent successfully. Check webhook logs for delivery status.',
        },
        repositoryName: { type: 'string', example: 'owner/repo' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Repository does not have a webhook configured',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions or missing organization context',
  })
  @ApiResponse({
    status: 404,
    description: 'Repository not found or webhook not found on GitHub',
  })
  async testWebhookConnectivity(
    @Body() dto: TestWebhookDto,
    @GetOrganization('id') organizationId: string | undefined,
  ) {
    const orgId = this.validateOrganizationContext(organizationId);
    return this.githubService.testWebhookConnectivity(orgId, dto.repositoryId);
  }

  /**
   * Trigger backfill for a repository
   * Only OWNER and ADMIN roles can trigger backfill
   */
  @Post('repositories/:id/backfill')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiOperation({ summary: 'Trigger backfill for repository commits' })
  @ApiParam({ name: 'id', description: 'Repository ID' })
  @ApiQuery({
    name: 'days',
    required: false,
    description: 'Number of days to backfill (default: 90)',
  })
  @ApiResponse({
    status: 201,
    description: 'Backfill started successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions or missing organization context',
  })
  @ApiResponse({
    status: 404,
    description: 'Repository not found',
  })
  async triggerBackfill(@Param('id') repoId: string, @Query('days') days?: string) {
    const daysNum = days ? parseInt(days, 10) : 90;
    return this.backfillService.backfillRepository(repoId, daysNum);
  }

  /**
   * Get backfill status for a repository
   */
  @Get('repositories/:id/backfill/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get backfill status for repository' })
  @ApiParam({ name: 'id', description: 'Repository ID' })
  @ApiResponse({
    status: 200,
    description: 'Backfill status',
  })
  @ApiResponse({
    status: 403,
    description: 'Missing organization context',
  })
  @ApiResponse({
    status: 404,
    description: 'Repository not found',
  })
  async getBackfillStatus(@Param('id') repoId: string) {
    return this.backfillService.getBackfillStatus(repoId);
  }

  /**
   * Query webhook logs
   * Requires authentication and organization context
   */
  @Get('webhooks/logs')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Query webhook delivery logs' })
  @ApiResponse({
    status: 200,
    description: 'Webhook logs retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'log-uuid-123' },
          deliveryId: { type: 'string', example: 'delivery-uuid-456' },
          eventType: { type: 'string', example: 'push' },
          repositoryId: { type: 'string', example: 'repo-uuid-789' },
          status: { type: 'string', enum: ['PENDING', 'SUCCESS', 'FAILED'], example: 'SUCCESS' },
          responseTimeMs: { type: 'number', nullable: true, example: 150 },
          errorMessage: { type: 'string', nullable: true, example: null },
          payloadSize: { type: 'number', example: 2048 },
          createdAt: { type: 'string', format: 'date-time', example: '2024-01-15T10:30:00Z' },
          updatedAt: { type: 'string', format: 'date-time', example: '2024-01-15T10:30:01Z' },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid query parameters',
  })
  @ApiResponse({
    status: 403,
    description: 'Missing organization context or insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Repository not found or not accessible',
  })
  async getWebhookLogs(
    @Query() query: QueryWebhookLogsDto,
    @GetOrganization('id') organizationId: string | undefined,
    @GetUser() user: { id: string; role: Role },
  ) {
    const orgId = this.validateOrganizationContext(organizationId);

    // If repositoryId is provided, validate it belongs to the organization
    if (query.repositoryId) {
      const repository = await this.githubService.getRepository(query.repositoryId);
      if (!repository || repository.organizationId !== orgId) {
        throw new ForbiddenException('Repository not found or not accessible');
      }
    }

    // Set default date range if not provided (last 7 days)
    const endDate = query.endDate ? new Date(query.endDate) : new Date();
    const startDate = query.startDate
      ? new Date(query.startDate)
      : new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

    // If no repositoryId provided, get all repositories for the organization
    if (!query.repositoryId) {
      const repositories = await this.githubService.getRepositoriesByOrganization(
        orgId,
        user.id,
        user.role,
      );
      const allLogs = await Promise.all(
        repositories.map((repo) =>
          this.webhookLogService.queryLogs(repo.id, startDate, endDate, query.status),
        ),
      );
      // Flatten and sort by createdAt descending
      return allLogs.flat().sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    return this.webhookLogService.queryLogs(query.repositoryId, startDate, endDate, query.status);
  }

  /**
   * Get webhook health metrics for organization
   */
  @Get('webhooks/health')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get webhook health metrics for organization',
    description:
      'Returns webhook health metrics including delivery counts, success rates, and average response times for all repositories in the organization',
  })
  @ApiQuery({
    name: 'period',
    required: false,
    enum: ['24h', '7d', '30d'],
    description: 'Time period for health metrics (default: 7d)',
    example: '7d',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook health metrics retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          repositoryId: { type: 'string', example: 'repo-uuid-123' },
          repositoryName: { type: 'string', example: 'owner/repo' },
          totalDeliveries: { type: 'number', example: 150 },
          successfulDeliveries: { type: 'number', example: 145 },
          failedDeliveries: { type: 'number', example: 5 },
          successRate: { type: 'number', example: 96.67 },
          averageResponseTimeMs: { type: 'number', example: 125.5 },
          eventTypeCounts: {
            type: 'object',
            example: { push: 100, pull_request: 30, issues: 20 },
          },
          period: { type: 'string', example: '7d' },
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid query parameters',
  })
  @ApiResponse({
    status: 403,
    description: 'Missing organization context or insufficient permissions',
  })
  async getWebhookHealth(
    @Query() query: QueryWebhookHealthDto,
    @GetOrganization('id') organizationId: string | undefined,
  ) {
    const orgId = this.validateOrganizationContext(organizationId);

    // Default to 7d if not provided
    const period = query.period || '7d';

    // Get health metrics for all repositories in the organization
    return this.webhookMonitoringService.getOrganizationMetrics(orgId, period);
  }

  /**
   * Manually retry a failed webhook delivery
   * Only OWNER and ADMIN roles can retry webhooks
   */
  @Post('webhooks/retry/:deliveryId')
  @AuditLog({
    action: 'UPDATE',
    resourceType: 'WebhookLog',
    resourceIdParam: 'deliveryId',
    captureSnapshot: false,
    includeRequestBody: false,
    includeResponseBody: true,
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiOperation({
    summary: 'Manually retry a failed webhook delivery',
    description:
      'Fetches the original webhook payload from the log and reprocesses it through the webhook pipeline. Useful for recovering from transient failures.',
  })
  @ApiParam({
    name: 'deliveryId',
    description: 'The delivery ID of the webhook to retry (from X-GitHub-Delivery header)',
    example: '12345678-1234-1234-1234-123456789abc',
  })
  @ApiResponse({
    status: 200,
    description: 'Webhook retry processed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        eventType: { type: 'string', example: 'push' },
        message: { type: 'string', example: 'Webhook retry processed successfully' },
        commitsQueued: { type: 'number', example: 3 },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Webhook delivery does not have a stored payload or repository not configured',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions or webhook belongs to different organization',
  })
  @ApiResponse({
    status: 404,
    description: 'Webhook delivery not found',
  })
  async retryWebhook(
    @Param('deliveryId') deliveryId: string,
    @GetOrganization('id') organizationId: string | undefined,
  ) {
    const orgId = this.validateOrganizationContext(organizationId);
    return this.webhookService.retryWebhookDelivery(deliveryId, orgId);
  }

  /**
   * Update rate limit configuration for organization
   * Only OWNER and ADMIN roles can update rate limit configuration
   */
  @Put('webhooks/rate-limit')
  @AuditLog({
    action: 'UPDATE',
    resourceType: 'WebhookRateLimit',
    resourceIdParam: 'organizationId',
    captureSnapshot: false,
    includeRequestBody: true,
    includeResponseBody: true,
  })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(Role.OWNER, Role.ADMIN)
  @ApiOperation({
    summary: 'Update webhook rate limit configuration for organization',
    description:
      'Updates the rate limit configuration for webhook requests. Rate limiting uses a sliding window algorithm to limit requests per minute per repository.',
  })
  @ApiResponse({
    status: 200,
    description: 'Rate limit configuration updated successfully',
    schema: {
      type: 'object',
      properties: {
        requestsPerMinute: { type: 'number', example: 100 },
        enabled: { type: 'boolean', example: true },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid configuration values',
  })
  @ApiResponse({
    status: 403,
    description: 'Missing organization context or insufficient permissions',
  })
  async updateRateLimit(
    @Body() dto: UpdateRateLimitDto,
    @GetOrganization('id') organizationId: string | undefined,
  ) {
    const orgId = this.validateOrganizationContext(organizationId);

    // Update rate limit configuration
    await this.rateLimitService.updateRateLimitConfig(orgId, {
      requestsPerMinute: dto.requestsPerMinute,
      enabled: dto.enabled,
    });

    // Return the updated configuration
    return this.rateLimitService.getRateLimitConfig(orgId);
  }
}
