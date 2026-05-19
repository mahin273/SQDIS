import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma';
import { AlertType, AlertSeverity } from '@prisma/client';
import { CreateAlertThresholdConfigDto, UpdateAlertThresholdConfigDto } from '../dto';

/**
 * Default threshold values for alert severity mapping
 */
export const DEFAULT_THRESHOLDS = {
  lowThreshold: 0.0,
  mediumThreshold: 0.5,
  highThreshold: 0.7,
  criticalThreshold: 0.9,
  minSeverity: AlertSeverity.LOW,
};

/**
 * Service for managing alert threshold configurations per organization
 */
@Injectable()
export class ThresholdConfigService {
  private readonly logger = new Logger(ThresholdConfigService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get threshold configuration for an organization and alert type
   * Creates default config if none exists
   */
  async getConfig(organizationId: string, alertType: AlertType = AlertType.ANOMALY) {
    const config = await this.prisma.alertThresholdConfig.findUnique({
      where: {
        organizationId_alertType: {
          organizationId,
          alertType,
        },
      },
    });

    // Return default config if none exists
    if (!config) {
      return {
        id: null,
        organizationId,
        alertType,
        ...DEFAULT_THRESHOLDS,
        isActive: true,
        createdAt: null,
        updatedAt: null,
        createdBy: null,
        updatedBy: null,
        isDefault: true,
      };
    }

    return { ...config, isDefault: false };
  }

  /**
   * Get all threshold configurations for an organization
   */
  async getAllConfigs(organizationId: string) {
    const configs = await this.prisma.alertThresholdConfig.findMany({
      where: { organizationId },
      orderBy: { alertType: 'asc' },
    });

    // Add default configs for alert types that don't have custom configs
    const alertTypes = Object.values(AlertType);
    const existingTypes = new Set(configs.map((c) => c.alertType));

    const allConfigs: Array<{
      id: string | null;
      organizationId: string;
      alertType: AlertType;
      lowThreshold: number;
      mediumThreshold: number;
      highThreshold: number;
      criticalThreshold: number;
      minSeverity: AlertSeverity;
      isActive: boolean;
      createdAt: Date | null;
      updatedAt: Date | null;
      createdBy: string | null;
      updatedBy: string | null;
      isDefault: boolean;
    }> = [...configs.map((c) => ({ ...c, isDefault: false }))];

    for (const alertType of alertTypes) {
      if (!existingTypes.has(alertType)) {
        allConfigs.push({
          id: null,
          organizationId,
          alertType,
          ...DEFAULT_THRESHOLDS,
          isActive: true,
          createdAt: null,
          updatedAt: null,
          createdBy: null,
          updatedBy: null,
          isDefault: true,
        });
      }
    }

    return allConfigs;
  }

  /**
   * Create or update threshold configuration for an organization
   */
  async upsertConfig(organizationId: string, dto: CreateAlertThresholdConfigDto, userId?: string) {
    const alertType = dto.alertType || AlertType.ANOMALY;

    // Validate threshold ordering
    this.validateThresholds(dto);

    const config = await this.prisma.alertThresholdConfig.upsert({
      where: {
        organizationId_alertType: {
          organizationId,
          alertType,
        },
      },
      create: {
        organizationId,
        alertType,
        lowThreshold: dto.lowThreshold ?? DEFAULT_THRESHOLDS.lowThreshold,
        mediumThreshold: dto.mediumThreshold ?? DEFAULT_THRESHOLDS.mediumThreshold,
        highThreshold: dto.highThreshold ?? DEFAULT_THRESHOLDS.highThreshold,
        criticalThreshold: dto.criticalThreshold ?? DEFAULT_THRESHOLDS.criticalThreshold,
        minSeverity: dto.minSeverity ?? DEFAULT_THRESHOLDS.minSeverity,
        isActive: dto.isActive ?? true,
        createdBy: userId,
        updatedBy: userId,
      },
      update: {
        lowThreshold: dto.lowThreshold,
        mediumThreshold: dto.mediumThreshold,
        highThreshold: dto.highThreshold,
        criticalThreshold: dto.criticalThreshold,
        minSeverity: dto.minSeverity,
        isActive: dto.isActive,
        updatedBy: userId,
      },
    });

    this.logger.log(`Upserted threshold config for org ${organizationId}, type ${alertType}`);

    return config;
  }

  /**
   * Update threshold configuration
   */
  async updateConfig(
    organizationId: string,
    alertType: AlertType,
    dto: UpdateAlertThresholdConfigDto,
    userId?: string,
  ) {
    const existing = await this.prisma.alertThresholdConfig.findUnique({
      where: {
        organizationId_alertType: {
          organizationId,
          alertType,
        },
      },
    });

    if (!existing) {
      // Create new config with provided values
      return this.upsertConfig(organizationId, { alertType, ...dto }, userId);
    }

    // Merge existing values with updates for validation
    const merged = {
      lowThreshold: dto.lowThreshold ?? existing.lowThreshold,
      mediumThreshold: dto.mediumThreshold ?? existing.mediumThreshold,
      highThreshold: dto.highThreshold ?? existing.highThreshold,
      criticalThreshold: dto.criticalThreshold ?? existing.criticalThreshold,
    };

    this.validateThresholds(merged);

    return this.prisma.alertThresholdConfig.update({
      where: {
        organizationId_alertType: {
          organizationId,
          alertType,
        },
      },
      data: {
        ...dto,
        updatedBy: userId,
      },
    });
  }

  /**
   * Reset threshold configuration to defaults
   */
  async resetConfig(organizationId: string, alertType?: AlertType) {
    if (alertType) {
      // Reset specific alert type
      await this.prisma.alertThresholdConfig.deleteMany({
        where: {
          organizationId,
          alertType,
        },
      });

      this.logger.log(`Reset threshold config for org ${organizationId}, type ${alertType}`);
    } else {
      // Reset all configs for organization
      await this.prisma.alertThresholdConfig.deleteMany({
        where: { organizationId },
      });

      this.logger.log(`Reset all threshold configs for org ${organizationId}`);
    }

    return { success: true, message: 'Threshold configuration reset to defaults' };
  }

  /**
   * Map anomaly score to severity using organization's custom thresholds
   */
  async mapScoreToSeverity(
    organizationId: string,
    score: number,
    alertType: AlertType = AlertType.ANOMALY,
  ): Promise<{ severity: AlertSeverity; shouldAlert: boolean }> {
    const config = await this.getConfig(organizationId, alertType);

    let severity: AlertSeverity;

    if (score < config.lowThreshold) {
      // Below minimum threshold - no alert
      return { severity: AlertSeverity.LOW, shouldAlert: false };
    } else if (score < config.mediumThreshold) {
      severity = AlertSeverity.LOW;
    } else if (score < config.highThreshold) {
      severity = AlertSeverity.MEDIUM;
    } else if (score < config.criticalThreshold) {
      severity = AlertSeverity.HIGH;
    } else {
      severity = AlertSeverity.CRITICAL;
    }

    // Check if severity meets minimum threshold
    const severityOrder = [
      AlertSeverity.LOW,
      AlertSeverity.MEDIUM,
      AlertSeverity.HIGH,
      AlertSeverity.CRITICAL,
    ];
    const severityIndex = severityOrder.indexOf(severity);
    const minSeverityIndex = severityOrder.indexOf(config.minSeverity);

    const shouldAlert = config.isActive && severityIndex >= minSeverityIndex;

    return { severity, shouldAlert };
  }

  /**
   * Validate that thresholds are in ascending order
   */
  private validateThresholds(dto: {
    lowThreshold?: number;
    mediumThreshold?: number;
    highThreshold?: number;
    criticalThreshold?: number;
  }) {
    const low = dto.lowThreshold ?? DEFAULT_THRESHOLDS.lowThreshold;
    const medium = dto.mediumThreshold ?? DEFAULT_THRESHOLDS.mediumThreshold;
    const high = dto.highThreshold ?? DEFAULT_THRESHOLDS.highThreshold;
    const critical = dto.criticalThreshold ?? DEFAULT_THRESHOLDS.criticalThreshold;

    if (low > medium || medium > high || high > critical) {
      throw new Error('Thresholds must be in ascending order: low <= medium <= high <= critical');
    }
  }
}
