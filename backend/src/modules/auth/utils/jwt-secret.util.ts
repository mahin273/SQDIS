import { ConfigService } from '@nestjs/config';

export function getRequiredJwtSecret(configService: ConfigService): string {
  const secret = configService.get<string>('JWT_SECRET');

  if (!secret || secret.trim().length === 0) {
    throw new Error('JWT_SECRET must be configured');
  }

  return secret;
}
