import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { MetricsService } from './metrics.service.js';

/**
 * Prometheus Metrics Controller
 *
 * Exposes GET /metrics endpoint for Prometheus scraping
 */
@Controller()
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  /**
   * GET /metrics - Prometheus metrics endpoint
   * Returns all collected metrics in Prometheus text format
   */
  @Get('metrics')
  async getMetrics(@Res() res: Response): Promise<void> {
    const metrics = await this.metricsService.getMetrics();
    res.set('Content-Type', this.metricsService.getContentType());
    res.send(metrics);
  }
}
