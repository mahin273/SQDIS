import { Module, Global } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MetricsService } from './metrics.service.js';
import { MetricsController } from './metrics.controller.js';
import { HttpMetricsInterceptor } from './interceptors/http-metrics.interceptor.js';
import { BullMQMetricsService } from './services/bullmq-metrics.service.js';

/**
 * Prometheus Metrics Module
 * Global module that provides:
 * - MetricsService for recording custom metrics
 * - BullMQMetricsService for job queue metrics
 * - /metrics endpoint for Prometheus scraping
 * - HTTP request metrics interceptor
 */
@Global()
@Module({
  controllers: [MetricsController],
  providers: [
    MetricsService,
    BullMQMetricsService,
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpMetricsInterceptor,
    },
  ],
  exports: [MetricsService, BullMQMetricsService],
})
export class MetricsModule {}
