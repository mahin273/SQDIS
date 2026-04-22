import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  Registry,
  Counter,
  Histogram,
  Gauge,
  collectDefaultMetrics,
} from 'prom-client';

/**
 * Prometheus Metrics Service
 * Provides comprehensive metrics for:
 * - HTTP requests (count, duration, status codes)
 * - Database queries (count, duration)
 * - Redis operations (count, duration, hits/misses)
 * - BullMQ jobs (count, duration, status)
 * - ML predictions (count, duration, scores)
 */
@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly registry: Registry;

  // HTTP Request Metrics
  public readonly httpRequestsTotal: Counter;
  public readonly httpRequestDuration: Histogram;
  public readonly httpRequestsInFlight: Gauge;

  // Database Metrics
  public readonly dbQueriesTotal: Counter;
  public readonly dbQueryDuration: Histogram;
  public readonly dbConnectionPoolSize: Gauge;
  public readonly dbConnectionPoolActive: Gauge;

  // Redis Metrics
  public readonly redisOperationsTotal: Counter;
  public readonly redisOperationDuration: Histogram;
  public readonly redisCacheHits: Counter;
  public readonly redisCacheMisses: Counter;
  public readonly redisConnectionStatus: Gauge;

  // BullMQ Job Metrics
  public readonly bullmqJobsTotal: Counter;
  public readonly bullmqJobDuration: Histogram;
  public readonly bullmqJobsActive: Gauge;
  public readonly bullmqJobsWaiting: Gauge;
  public readonly bullmqJobsFailed: Counter;
  public readonly bullmqJobsCompleted: Counter;

  // ML Prediction Metrics
  public readonly mlPredictionsTotal: Counter;
  public readonly mlPredictionDuration: Histogram;
  public readonly mlPredictionErrors: Counter;
  public readonly dqsScoreDistribution: Histogram;
  public readonly sqsScoreDistribution: Histogram;

  // Webhook Metrics
  public readonly webhooksReceivedTotal: Counter;
  public readonly webhooksProcessedTotal: Counter;
  public readonly webhooksFailedTotal: Counter;

  constructor() {
    this.registry = new Registry();

    // HTTP Request Metrics
    this.httpRequestsTotal = new Counter({
      name: 'sqdis_http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'path', 'status_code'],
      registers: [this.registry],
    });

    this.httpRequestDuration = new Histogram({
      name: 'sqdis_http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'path', 'status_code'],
      buckets: [0.01, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10],
      registers: [this.registry],
    });

    this.httpRequestsInFlight = new Gauge({
      name: 'sqdis_http_requests_in_flight',
      help: 'Number of HTTP requests currently being processed',
      registers: [this.registry],
    });

    // Database Metrics
    this.dbQueriesTotal = new Counter({
      name: 'sqdis_db_queries_total',
      help: 'Total number of database queries',
      labelNames: ['operation', 'model'],
      registers: [this.registry],
    });

    this.dbQueryDuration = new Histogram({
      name: 'sqdis_db_query_duration_seconds',
      help: 'Database query duration in seconds',
      labelNames: ['operation', 'model'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
      registers: [this.registry],
    });

    this.dbConnectionPoolSize = new Gauge({
      name: 'sqdis_db_connection_pool_size',
      help: 'Database connection pool size',
      registers: [this.registry],
    });

    this.dbConnectionPoolActive = new Gauge({
      name: 'sqdis_db_connection_pool_active',
      help: 'Number of active database connections',
      registers: [this.registry],
    });

    // Redis Metrics
    this.redisOperationsTotal = new Counter({
      name: 'sqdis_redis_operations_total',
      help: 'Total number of Redis operations',
      labelNames: ['operation'],
      registers: [this.registry],
    });

    this.redisOperationDuration = new Histogram({
      name: 'sqdis_redis_operation_duration_seconds',
      help: 'Redis operation duration in seconds',
      labelNames: ['operation'],
      buckets: [0.0001, 0.0005, 0.001, 0.005, 0.01, 0.05, 0.1],
      registers: [this.registry],
    });

    this.redisCacheHits = new Counter({
      name: 'sqdis_redis_cache_hits_total',
      help: 'Total number of Redis cache hits',
      labelNames: ['key_prefix'],
      registers: [this.registry],
    });

    this.redisCacheMisses = new Counter({
      name: 'sqdis_redis_cache_misses_total',
      help: 'Total number of Redis cache misses',
      labelNames: ['key_prefix'],
      registers: [this.registry],
    });

    this.redisConnectionStatus = new Gauge({
      name: 'sqdis_redis_connection_status',
      help: 'Redis connection status (1 = connected, 0 = disconnected)',
      registers: [this.registry],
    });

    // BullMQ Job Metrics
    this.bullmqJobsTotal = new Counter({
      name: 'sqdis_bullmq_jobs_total',
      help: 'Total number of BullMQ jobs',
      labelNames: ['queue', 'status'],
      registers: [this.registry],
    });

    this.bullmqJobDuration = new Histogram({
      name: 'sqdis_bullmq_job_duration_seconds',
      help: 'BullMQ job processing duration in seconds',
      labelNames: ['queue', 'job_type'],
      buckets: [0.1, 0.5, 1, 5, 10, 30, 60, 120, 300],
      registers: [this.registry],
    });

    this.bullmqJobsActive = new Gauge({
      name: 'sqdis_bullmq_jobs_active',
      help: 'Number of active BullMQ jobs',
      labelNames: ['queue'],
      registers: [this.registry],
    });

    this.bullmqJobsWaiting = new Gauge({
      name: 'sqdis_bullmq_jobs_waiting',
      help: 'Number of waiting BullMQ jobs',
      labelNames: ['queue'],
      registers: [this.registry],
    });

    this.bullmqJobsCompleted = new Counter({
      name: 'sqdis_bullmq_jobs_completed_total',
      help: 'Total number of completed BullMQ jobs',
      labelNames: ['queue'],
      registers: [this.registry],
    });

    this.bullmqJobsFailed = new Counter({
      name: 'sqdis_bullmq_jobs_failed_total',
      help: 'Total number of failed BullMQ jobs',
      labelNames: ['queue'],
      registers: [this.registry],
    });

    // ML Prediction Metrics
    this.mlPredictionsTotal = new Counter({
      name: 'sqdis_ml_predictions_total',
      help: 'Total number of ML predictions',
      labelNames: ['model_type', 'model_version'],
      registers: [this.registry],
    });

    this.mlPredictionDuration = new Histogram({
      name: 'sqdis_ml_prediction_duration_seconds',
      help: 'ML prediction duration in seconds',
      labelNames: ['model_type'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
      registers: [this.registry],
    });

    this.mlPredictionErrors = new Counter({
      name: 'sqdis_ml_prediction_errors_total',
      help: 'Total number of ML prediction errors',
      labelNames: ['model_type', 'error_type'],
      registers: [this.registry],
    });

    this.dqsScoreDistribution = new Histogram({
      name: 'sqdis_dqs_score_distribution',
      help: 'Distribution of DQS scores',
      buckets: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
      registers: [this.registry],
    });

    this.sqsScoreDistribution = new Histogram({
      name: 'sqdis_sqs_score_distribution',
      help: 'Distribution of SQS scores',
      buckets: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
      registers: [this.registry],
    });

    // Webhook Metrics
    this.webhooksReceivedTotal = new Counter({
      name: 'sqdis_webhooks_received_total',
      help: 'Total number of webhooks received',
      labelNames: ['event_type'],
      registers: [this.registry],
    });

    this.webhooksProcessedTotal = new Counter({
      name: 'sqdis_webhooks_processed_total',
      help: 'Total number of webhooks successfully processed',
      labelNames: ['event_type'],
      registers: [this.registry],
    });

    this.webhooksFailedTotal = new Counter({
      name: 'sqdis_webhooks_failed_total',
      help: 'Total number of failed webhooks',
      labelNames: ['event_type', 'error_type'],
      registers: [this.registry],
    });
  }

  onModuleInit() {
    // Collect default Node.js metrics (CPU, memory, event loop, etc.)
    collectDefaultMetrics({
      register: this.registry,
      prefix: 'sqdis_',
    });
  }

  /**
   * Get all metrics in Prometheus format
   */
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  /**
   * Get content type for Prometheus metrics
   */
  getContentType(): string {
    return this.registry.contentType;
  }

  /**
   * Get the registry for custom metric registration
   */
  getRegistry(): Registry {
    return this.registry;
  }
}
