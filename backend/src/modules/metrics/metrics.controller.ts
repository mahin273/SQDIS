import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { MetricsService } from './metrics.service.js';

/**
 * Prometheus Metrics Controller
 *
 * Exposes GET /metrics endpoint for Prometheus scraping
 */
@ApiTags('Metrics')
@Controller()
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  /**
   * GET /metrics - Prometheus metrics endpoint
   * Returns all collected metrics in Prometheus text format
   */
  @Get('metrics')
  @ApiOperation({ summary: 'Prometheus metrics endpoint' })
  @ApiResponse({ status: 200, description: 'All collected metrics in Prometheus text format' })
  async getMetrics(@Res() res: Response): Promise<void> {
    const metrics = await this.metricsService.getMetrics();
    res.set('Content-Type', this.metricsService.getContentType());
    res.send(metrics);
  }
}
