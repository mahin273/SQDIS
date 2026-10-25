import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { WebSocketGateway } from './websocket.gateway';
import { ChannelManager } from './channel-manager.service';
import { WebSocketEventsService } from './websocket-events.service';
import { WebSocketAuthGuard } from './guards/websocket-auth.guard';
import { RedisPubSubSubscriber } from './redis-pubsub-subscriber.service';
import { CacheModule } from '../cache/cache.module';
import { AuthModule } from '../auth/auth.module';

/**
 * WebSocket Module for real-time communication
 * Implements Socket.io with JWT authentication and Redis Pub/Sub for scaling
 */
@Module({
  imports: [
    EventEmitterModule.forRoot(),
    CacheModule,
    forwardRef(() => AuthModule),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'default-secret-change-in-production'),
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    WebSocketGateway,
    ChannelManager,
    WebSocketEventsService,
    WebSocketAuthGuard,
    RedisPubSubSubscriber,
  ],
  exports: [WebSocketGateway, ChannelManager, WebSocketEventsService],
})
export class WebSocketModule {}
