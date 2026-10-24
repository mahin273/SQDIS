import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';

@Injectable()
export class BullBoardAuthMiddleware implements NestMiddleware {
  private readonly logger = new Logger(BullBoardAuthMiddleware.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const isEnabled = this.configService.get<string>('BULL_BOARD_ENABLED', 'false') === 'true';
    if (!isEnabled) {
      this.logger.warn('Blocked access to disabled Bull Board queue dashboard');
      return res.status(403).json({
        statusCode: 403,
        message: 'Bull Board queue dashboard is disabled',
      });
    }

    const authHeader = req.headers.authorization || (req.headers['Authorization'] as string);

    // 1. Support Basic Authentication
    if (authHeader && authHeader.startsWith('Basic ')) {
      const base64Credentials = authHeader.substring(6).trim();
      const decoded = Buffer.from(base64Credentials, 'base64').toString('utf-8');
      const colonIndex = decoded.indexOf(':');

      if (colonIndex > 0) {
        const username = decoded.substring(0, colonIndex);
        const password = decoded.substring(colonIndex + 1);

        const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
        const isProduction = nodeEnv === 'production';
        const expectedUser = this.configService.get<string>('BULL_BOARD_USER', isProduction ? '' : 'admin');
        const expectedPass = this.configService.get<string>('BULL_BOARD_PASSWORD', isProduction ? '' : 'sqdis-admin-secret');

        if (isProduction && (!expectedPass || expectedPass === 'sqdis-admin-secret')) {
          this.logger.error('Insecure or default Bull Board password in production');
          return res.status(500).json({
            statusCode: 500,
            message: 'Insecure Bull Board configuration in production',
          });
        }

        if (expectedUser && expectedPass && username === expectedUser && password === expectedPass) {
          return next();
        }
      }
    }

    // 2. Support Bearer JWT Authentication (Role.ADMIN or Role.OWNER)
    let token: string | undefined;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else if (req.cookies && (req.cookies as any).accessToken) {
      token = (req.cookies as any).accessToken;
    } else if (req.query && typeof req.query.token === 'string') {
      token = req.query.token as string;
    }

    if (token) {
      try {
        const payload = await this.jwtService.verifyAsync(token);
        const role = payload.role || payload.systemRole;
        if (role === Role.ADMIN || role === Role.OWNER) {
          return next();
        }
        this.logger.warn(
          `Unauthorized Bull Board access attempt by non-admin user ${payload.id || payload.sub}`,
        );
        return res.status(403).json({
          statusCode: 403,
          message: 'Admin or Owner privileges required to access Bull Board dashboard',
        });
      } catch (err: any) {
        this.logger.warn(`Invalid JWT token for Bull Board access: ${err.message}`);
      }
    }

    // 3. Reject with 401 and WWW-Authenticate to trigger browser login modal
    res.setHeader('WWW-Authenticate', 'Basic realm="Bull Board Admin Area"');
    return res.status(401).send('Authentication required to access Bull Board dashboard');
  }
}
