import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

/**
 * Email configuration for Nodemailer SMTP transport
 */
export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
  appBaseUrl: string;
}

/**
 * Get email configuration from environment variables
 */
export const getEmailConfig = (configService: ConfigService): EmailConfig => ({
  host: configService.get<string>('SMTP_HOST', 'smtp.gmail.com'),
  port: configService.get<number>('SMTP_PORT', 587),
  secure: configService.get<number>('SMTP_PORT', 587) === 465,
  auth: {
    user: configService.get<string>('SMTP_USER', ''),
    pass: configService.get<string>('SMTP_PASS', ''),
  },
  from: configService.get<string>('SMTP_FROM', 'noreply@sqdis.com'),
  appBaseUrl: configService.get<string>('APP_BASE_URL', 'http://localhost:3000'),
});

/**
 * Create Nodemailer transporter with SMTP configuration
 */
export const createEmailTransporter = (config: EmailConfig) => {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.auth.user,
      pass: config.auth.pass,
    },
  });
};
