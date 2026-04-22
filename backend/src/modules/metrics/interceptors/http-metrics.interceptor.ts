import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, finalize } from 'rxjs/operators';
import { Request, Response } from 'express';
import { MetricsService } from '../metrics.service.js';

/**
 * HTTP Metrics Interceptor
 * Collects metrics for all HTTP requests:
 * - Request count by method, path, and status code
 * - Request duration histogram
 * - Requests in flight gauge
 */
@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    if (request.path === '/metrics') {
      return next.handle();
    }

    const method = request.method;
    const path = this.normalizePath(request.route?.path || request.path);
    const startTime = Date.now();

    // Increment in-flight requests
    this.metricsService.httpRequestsInFlight.inc();

    return next.handle().pipe(
      tap({
        next: () => {
          // Request completed successfully
          this.recordMetrics(method, path, response.statusCode, startTime);
        },
        error: (error) => {
          // Request failed with error
          const statusCode = error.status || error.statusCode || 500;
          this.recordMetrics(method, path, statusCode, startTime);
        },
      }),
      finalize(() => {
        // Decrement in-flight requests
        this.metricsService.httpRequestsInFlight.dec();
      }),
    );
  }

  /**
   * Record HTTP metrics
   */
  private recordMetrics(
    method: string,
    path: string,
    statusCode: number,
    startTime: number,
  ): void {
    const duration = (Date.now() - startTime) / 1000; // Convert to seconds
    const labels = {
      method,
      path,
      status_code: statusCode.toString(),
    };

    this.metricsService.httpRequestsTotal.inc(labels);
    this.metricsService.httpRequestDuration.observe(labels, duration);
  }

  /**
   * Normalize path to avoid high cardinality
   * Replace dynamic segments (UUIDs, IDs) with placeholders
   */
  private normalizePath(path: string): string {
    // Replace UUIDs with :id placeholder
    const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
    let normalized = path.replace(uuidRegex, ':id');

    // Replace numeric IDs with :id placeholder
    normalized = normalized.replace(/\/\d+/g, '/:id');

    return normalized;
  }
}
