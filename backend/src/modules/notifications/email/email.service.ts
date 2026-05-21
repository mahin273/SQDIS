import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import { getEmailConfig, EmailConfig } from './email.config';

/**
 * Email sending options
 */
export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Email service for sending emails via SMTP
 */
@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private transporter!: Transporter;
  private config: EmailConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = getEmailConfig(configService);
  }

  /**
   * Initialize the email transporter on module init
   */
  async onModuleInit() {
    this.transporter = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: {
        user: this.config.auth.user,
        pass: this.config.auth.pass,
      },
    });

    // Verify connection on startup
    try {
      await this.transporter.verify();
      this.logger.log('SMTP connection verified successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(`SMTP connection verification failed: ${errorMessage}`);
      this.logger.warn('Email sending may not work properly');
    }
  }

  /**
   * Send an email
   * Send verification email
   */
  async sendEmail(options: SendEmailOptions): Promise<boolean> {
    try {
      const result = await this.transporter.sendMail({
        from: this.config.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || this.stripHtml(options.html),
      });

      this.logger.debug(`Email sent successfully to ${options.to}: ${result.messageId}`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send email to ${options.to}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Get the app base URL for links in emails
   */
  getAppBaseUrl(): string {
    return this.config.appBaseUrl;
  }

  /**
   * Strip HTML tags for plain text version
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
