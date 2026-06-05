import { Injectable, OnModuleInit, OnModuleDestroy, Inject, Optional } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { MetricsService } from '../modules/metrics';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private pool: Pool;
  private poolMetricsInterval?: NodeJS.Timeout;

  constructor(
    @Optional() @Inject(MetricsService) private readonly metricsService?: MetricsService,
  ) {
    const connectionString = process.env.DATABASE_URL;
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    super({ adapter });
    this.pool = pool;
  }

  async onModuleInit() {
    await this.$connect();

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

    // Update pool metrics every 10 seconds
    this.poolMetricsInterval = setInterval(() => {
      if (this.metricsService) {
        this.metricsService.dbConnectionPoolSize.set(this.pool.totalCount);
        this.metricsService.dbConnectionPoolActive.set(this.pool.totalCount - this.pool.idleCount);
      }
    }, 10000);
  }
}
