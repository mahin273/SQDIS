import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { GitHubStrategy } from './strategies/github.strategy';
import { OrganizationGuard } from './guards/organization.guard';
import { EmailThrottlerGuard } from './guards/email-throttler.guard';
import { OrganizationContextService } from './services/organization-context.service';
import { TokenService } from './services/token.service';
import { EmailService } from './services/email.service';
import { AuditLoggerService } from './services/audit-logger.service';
import { PermissionCacheService } from './services/permission-cache.service';
import { DataFilterService } from './services/data-filter.service';
import { PrismaModule } from '../../prisma';
import { OrganizationsModule } from '../organizations/organizations.module';
import { CacheModule } from '../cache/cache.module';

@Module({
  imports: [
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET', 'default-secret-change-in-production'),
        signOptions: {
          expiresIn: '15m',
        },
      }),
      inject: [ConfigService],
    }),
    ConfigModule,
    forwardRef(() => OrganizationsModule),
    CacheModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    GoogleStrategy,
    GitHubStrategy,
    OrganizationGuard,
    EmailThrottlerGuard,
    OrganizationContextService,
    TokenService,
    EmailService,
    AuditLoggerService,
    PermissionCacheService,
    DataFilterService,
  ],
  exports: [AuthService, JwtModule, OrganizationGuard, OrganizationContextService, PermissionCacheService, DataFilterService],
})
export class AuthModule {}
