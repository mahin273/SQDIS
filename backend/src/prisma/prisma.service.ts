import { Injectable, OnModuleInit, OnModuleDestroy, Inject, Optional } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { MetricsService } from '../modules/metrics';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;
  private poolMetricsInterval?: NodeJS.Timeout;
  private extendedClient: any;

  constructor(
    @Optional() @Inject(MetricsService) private readonly metricsService?: MetricsService,
  ) {
    const connectionString = process.env.DATABASE_URL;
    const maxPoolSize = parseInt(process.env.DATABASE_POOL_MAX || '20', 10);
    const pool = new Pool({
      connectionString,
      max: maxPoolSize,
      min: 2,
      idleTimeoutMillis: 30000,
    });
    const adapter = new PrismaPg(pool);
    super({ adapter });
    this.pool = pool;

    const metrics = this.metricsService;
    this.extendedClient = this.$extends({
      query: {
        async $allOperations({ model, operation, args, query }: any) {
          const start = performance.now();
          const targetModel = model || 'raw';
          const targetOp = operation || 'query';

          if (metrics) {
            metrics.dbConnectionPoolActive.inc();
          }

          try {
            const result = await query(args);
            const duration = (performance.now() - start) / 1000;
            if (metrics) {
              metrics.dbQueriesTotal.inc({ operation: targetOp, model: targetModel });
              metrics.dbQueryDuration.observe({ operation: targetOp, model: targetModel }, duration);
            }
            return result;
          } catch (error) {
            const duration = (performance.now() - start) / 1000;
            if (metrics) {
              metrics.dbQueriesTotal.inc({ operation: targetOp, model: targetModel });
              metrics.dbQueryDuration.observe({ operation: targetOp, model: targetModel }, duration);
            }
            throw error;
          } finally {
            if (metrics) {
              metrics.dbConnectionPoolActive.dec();
            }
          }
        },
      },
    });

    return new Proxy(this, {
      get: (target: any, prop: string | symbol, receiver: any) => {
        if (target.extendedClient && prop in target.extendedClient) {
          return target.extendedClient[prop];
        }
        return Reflect.get(target, prop, receiver);
      },
    });
  }

  async onModuleInit() {
    await this.$connect();

    // Initialize pool size gauge immediately to configured pool capacity
    if (this.metricsService) {
      const maxPoolSize = (this.pool as any).options?.max || 20;
      this.metricsService.dbConnectionPoolSize.set(maxPoolSize);
      this.metricsService.dbConnectionPoolActive.set(0);
    }

    // Update connection pool metrics periodically
    this.startPoolMetricsCollection();
  }

  async onModuleDestroy() {
    if (this.poolMetricsInterval) {
      clearInterval(this.poolMetricsInterval);
    }
    await this.$disconnect();
    await this.pool.end();
  }

  /**
   * Start periodic collection of connection pool metrics
   */
  private startPoolMetricsCollection(): void {
    if (!this.metricsService) return;

    const updatePoolMetrics = () => {
      if (!this.metricsService) return;
      const maxPoolSize = (this.pool as any).options?.max || 20;
      this.metricsService.dbConnectionPoolSize.set(maxPoolSize);

      // If pg has active checked out clients outside of tracked in-flight queries
      const pgActive = Math.max(0, this.pool.totalCount - this.pool.idleCount);
      if (pgActive > 0) {
        this.metricsService.dbConnectionPoolActive.set(pgActive);
      }
    };

    updatePoolMetrics();
    // Update pool metrics every 5 seconds
    this.poolMetricsInterval = setInterval(updatePoolMetrics, 5000);
  }
}
