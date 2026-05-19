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
@Controller('alerts')
@UseGuards(JwtAuthGuard, OrganizationGuard)
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
  async findAll(@Request() req: any, @Query() filters: AlertFiltersDto) {
    return await this.alertsService.findAll(req.user.organizationId, filters);
  }

  /**
   * Get notification preferences for current user
   * GET /api/alerts/preferences
   */
  @Get('preferences')
  async getPreferences(@Request() req: any) {
    return await this.alertsService.getPreferences(req.user.id);
  }

  /**
   * Update notification preferences for current user
   * PATCH /api/alerts/preferences
   */
  @Patch('preferences')
  async updatePreferences(@Request() req: any, @Body() dto: UpdateNotificationPreferencesDto) {
    return await this.alertsService.updatePreferences(req.user.id, dto);
  }

  // ==================== THRESHOLD CONFIGURATION ENDPOINTS ====================

  /**
   * Get all threshold configurations for the organization
   * GET /api/alerts/thresholds
   */
  @Get('thresholds')
  async getAllThresholdConfigs(@Request() req: any) {
    return this.thresholdConfigService.getAllConfigs(req.user.organizationId);
  }

  /**
   * Get threshold configuration for a specific alert type
   * GET /api/alerts/thresholds/:alertType
   */
  @Get('thresholds/:alertType')
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
  async resetThresholdConfig(@Request() req: any, @Param('alertType') alertType: AlertType) {
    return this.thresholdConfigService.resetConfig(req.user.organizationId, alertType);
  }

  // ==================== ALERT ENDPOINTS ====================

  /**
   * Get a specific alert by ID
   * GET /api/alerts/:id
   */
  @Get(':id')
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
  async resolve(@Request() req: any, @Param('id') id: string, @Body() dto: ResolveAlertDto) {
    return await this.alertsService.resolve(
      id,
      req.user.id,
      req.user.organizationId,
      dto.resolutionNotes,
    );
  }
}
