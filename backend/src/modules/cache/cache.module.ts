import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheService } from './cache.service.js';
import { RedisPubSubService } from './redis-pubsub.service.js';

/**
 * Global cache module providing Redis caching and pub/sub across the application
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [CacheService, RedisPubSubService],
  exports: [CacheService, RedisPubSubService],
})
export class CacheModule {}
