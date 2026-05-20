import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiBody } from '@nestjs/swagger';
import { AlertsService } from './alerts.service';
import { ThresholdConfigService } from './services/threshold-config.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { OrganizationGuard } from '../auth/guards/organization.guard';
import { AuditLog } from '../audit/decorators/audit-log.decorator';
import { Role } from '@prisma/client';
import {
  AlertFiltersDto,
  AcknowledgeAlertDto,
  ResolveAlertDto,
  UpdateNotificationPreferencesDto,
  CreateAlertThresholdConfigDto,
  UpdateAlertThresholdConfigDto,
  ResetAlertThresholdConfigDto,
} from './dto';
import { AlertType } from '@prisma/client';

/**
 * Controller for anomaly alerts and notification management
 */
@ApiTags('Alerts')
@Controller('alerts')
@UseGuards(JwtAuthGuard, OrganizationGuard)
@ApiBearerAuth()
export class AlertsController {
  constructor(
    private readonly alertsService: AlertsService,
    private readonly thresholdConfigService: ThresholdConfigService,
  ) {}

  /**
   * Get all alerts with pagination and filters
   * GET /api/alerts
   */
  @Get()
  @ApiOperation({ summary: 'Get all alerts with pagination and filters' })
  @ApiResponse({ status: 200, description: 'Paginated list of alerts with severity breakdown' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async findAll(@Request() req: any, @Query() filters: AlertFiltersDto) {
    return await this.alertsService.findAll(req.user.organizationId, filters);
  }

  /**
   * Get notification preferences for current user
   * GET /api/alerts/preferences
   */
  @Get('preferences')
  @ApiOperation({ summary: 'Get notification preferences for current user' })
  @ApiResponse({ status: 200, description: 'User notification preferences' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getPreferences(@Request() req: any) {
    return await this.alertsService.getPreferences(req.user.id);
  }

  /**
   * Update notification preferences for current user
   * PATCH /api/alerts/preferences
   */
  @Patch('preferences')
  @ApiOperation({ summary: 'Update notification preferences for current user' })
  @ApiBody({ type: UpdateNotificationPreferencesDto })
  @ApiResponse({ status: 200, description: 'Notification preferences updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updatePreferences(@Request() req: any, @Body() dto: UpdateNotificationPreferencesDto) {
    return await this.alertsService.updatePreferences(req.user.id, dto);
  }

  // ==================== THRESHOLD CONFIGURATION ENDPOINTS ====================

  /**
   * Get all threshold configurations for the organization
   * GET /api/alerts/thresholds
   */
  @Get('thresholds')
  @ApiOperation({ summary: 'Get all threshold configurations for the organization' })
  @ApiResponse({ status: 200, description: 'List of threshold configurations per alert type' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getAllThresholdConfigs(@Request() req: any) {
    return this.thresholdConfigService.getAllConfigs(req.user.organizationId);
  }

  /**
   * Get threshold configuration for a specific alert type
   * GET /api/alerts/thresholds/:alertType
   */
  @Get('thresholds/:alertType')
  @ApiOperation({ summary: 'Get threshold configuration for a specific alert type' })
  @ApiParam({ name: 'alertType', description: 'Alert type (e.g., ANOMALY)' })
  @ApiResponse({ status: 200, description: 'Threshold configuration for the alert type' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getThresholdConfig(@Request() req: any, @Param('alertType') alertType: AlertType) {
    return this.thresholdConfigService.getConfig(req.user.organizationId, alertType);
  }

  /**
   * Create or update threshold configuration
   * POST /api/alerts/thresholds
   */
  @Post('thresholds')
  @UseGuards(JwtAuthGuard, RolesGuard, OrganizationGuard)
  @Roles(Role.ADMIN, Role.OWNER)
  @AuditLog({
    action: 'CREATE',
    resourceType: 'AlertThresholdConfig',
    captureSnapshot: true,
    includeRequestBody: true,
    includeResponseBody: true,
  })
  @ApiOperation({ summary: 'Create or update threshold configuration' })
  @ApiBody({ type: CreateAlertThresholdConfigDto })
  @ApiResponse({ status: 201, description: 'Threshold configuration created/updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions (requires ADMIN or OWNER)' })
  async upsertThresholdConfig(@Request() req: any, @Body() dto: CreateAlertThresholdConfigDto) {
    return this.thresholdConfigService.upsertConfig(req.user.organizationId, dto, req.user.id);
  }

  /**
   * Update threshold configuration for a specific alert type
   * PATCH /api/alerts/thresholds/:alertType
   */
  @Patch('thresholds/:alertType')
  @UseGuards(JwtAuthGuard, RolesGuard, OrganizationGuard)
  @Roles(Role.ADMIN, Role.OWNER)
  @AuditLog({
    action: 'UPDATE',
    resourceType: 'AlertThresholdConfig',
    resourceIdParam: 'alertType',
    captureSnapshot: true,
    includeRequestBody: true,
    includeResponseBody: true,
  })
  @ApiOperation({ summary: 'Update threshold configuration for a specific alert type' })
  @ApiParam({ name: 'alertType', description: 'Alert type (e.g., ANOMALY)' })
  @ApiBody({ type: UpdateAlertThresholdConfigDto })
  @ApiResponse({ status: 200, description: 'Threshold configuration updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions (requires ADMIN or OWNER)' })
  async updateThresholdConfig(
    @Request() req: any,
    @Param('alertType') alertType: AlertType,
    @Body() dto: UpdateAlertThresholdConfigDto,
  ) {
    return this.thresholdConfigService.updateConfig(
      req.user.organizationId,
      alertType,
      dto,
      req.user.id,
    );
  }

  /**
   * Reset threshold configuration to defaults
   * DELETE /api/alerts/thresholds
   */
  @Delete('thresholds')
  @UseGuards(JwtAuthGuard, RolesGuard, OrganizationGuard)
  @Roles(Role.ADMIN, Role.OWNER)
  @AuditLog({
    action: 'DELETE',
    resourceType: 'AlertThresholdConfig',
    captureSnapshot: true,
    includeResponseBody: true,
  })
  @ApiOperation({ summary: 'Reset all threshold configurations to defaults' })
  @ApiResponse({ status: 200, description: 'All threshold configurations reset to defaults' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions (requires ADMIN or OWNER)' })
  async resetAllThresholdConfigs(@Request() req: any) {
    return this.thresholdConfigService.resetConfig(req.user.organizationId);
  }

  /**
   * Reset threshold configuration for a specific alert type
   * DELETE /api/alerts/thresholds/:alertType
   */
  @Delete('thresholds/:alertType')
  @UseGuards(JwtAuthGuard, RolesGuard, OrganizationGuard)
  @Roles(Role.ADMIN, Role.OWNER)
  @AuditLog({
    action: 'DELETE',
    resourceType: 'AlertThresholdConfig',
    resourceIdParam: 'alertType',
    captureSnapshot: true,
    includeResponseBody: true,
  })
  @ApiOperation({ summary: 'Reset threshold configuration for a specific alert type' })
  @ApiParam({ name: 'alertType', description: 'Alert type to reset (e.g., ANOMALY)' })
  @ApiResponse({ status: 200, description: 'Threshold configuration reset to defaults' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions (requires ADMIN or OWNER)' })
  async resetThresholdConfig(@Request() req: any, @Param('alertType') alertType: AlertType) {
    return this.thresholdConfigService.resetConfig(req.user.organizationId, alertType);
  }

  // ==================== ALERT ENDPOINTS ====================

  /**
   * Get a specific alert by ID
   * GET /api/alerts/:id
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get a specific alert by ID' })
  @ApiParam({ name: 'id', description: 'Alert ID' })
  @ApiResponse({ status: 200, description: 'Alert details with acknowledger and resolver info' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Alert not found' })
  async findById(@Request() req: any, @Param('id') id: string) {
    const alert = await this.alertsService.findById(id, req.user.organizationId);
    if (!alert) {
      throw new NotFoundException(`Alert with ID ${id} not found`);
    }
    return alert;
  }

  /**
   * Acknowledge an alert
   * POST /api/alerts/:id/acknowledge
   */
  @Post(':id/acknowledge')
  @ApiOperation({ summary: 'Acknowledge an alert' })
  @ApiParam({ name: 'id', description: 'Alert ID' })
  @ApiBody({ type: AcknowledgeAlertDto })
  @ApiResponse({ status: 201, description: 'Alert acknowledged successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Alert not found' })
  async acknowledge(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: AcknowledgeAlertDto,
  ) {
    return await this.alertsService.acknowledge(id, req.user.id, req.user.organizationId);
  }

  /**
   * Resolve an alert
   * POST /api/alerts/:id/resolve
   */
  @Post(':id/resolve')
  @ApiOperation({ summary: 'Resolve an alert with resolution notes' })
  @ApiParam({ name: 'id', description: 'Alert ID' })
  @ApiBody({ type: ResolveAlertDto })
  @ApiResponse({ status: 201, description: 'Alert resolved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Alert not found' })
  async resolve(@Request() req: any, @Param('id') id: string, @Body() dto: ResolveAlertDto) {
    return await this.alertsService.resolve(
      id,
      req.user.id,
      req.user.organizationId,
      dto.resolutionNotes,
    );
  }
}
