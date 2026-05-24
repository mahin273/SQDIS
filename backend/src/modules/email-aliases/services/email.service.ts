import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

/**
 * Service for sending emails using Nodemailer
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter!: Transporter;

  constructor(private readonly configService: ConfigService) {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const host = this.configService.get<string>('SMTP_HOST', 'smtp.gmail.com');
    const port = this.configService.get<number>('SMTP_PORT', 587);
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    if (!user || !pass) {
      this.logger.warn('SMTP credentials not configured. Email sending will be disabled.');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user,
        pass,
      },
    });
  }

  /**
   * Send verification email for email alias
   */
  async sendVerificationEmail(toEmail: string, verificationToken: string): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn(
        `Email sending disabled. Verification token for ${toEmail}: ${verificationToken}`,
      );
      return false;
    }

    const baseUrl = this.configService.get<string>('APP_BASE_URL', 'http://localhost:3000');
    const verificationUrl = `${baseUrl}/api/email-aliases/verify/${verificationToken}`;
    const fromEmail = this.configService.get<string>('SMTP_FROM', 'noreply@sqdis.com');

    const mailOptions = {
      from: `"SQDIS" <${fromEmail}>`,
      to: toEmail,
      subject: 'Verify your email address - SQDIS',
      html: this.getVerificationEmailTemplate(toEmail, verificationUrl),
      text: this.getVerificationEmailText(toEmail, verificationUrl),
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Verification email sent to ${toEmail}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send verification email to ${toEmail}`, error);
      return false;
    }
  }

  private getVerificationEmailTemplate(email: string, verificationUrl: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your email - SQDIS</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0;">SQDIS</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Software Quality & Developer Intelligence System</p>
  </div>
  
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
    <h2 style="color: #333; margin-top: 0;">Verify Your Email Address</h2>
    
    <p>You've requested to add <strong>${email}</strong> as an email alias to your SQDIS account.</p>
    
    <p>Click the button below to verify this email address:</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${verificationUrl}" 
         style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                color: white; 
                padding: 15px 30px; 
                text-decoration: none; 
                border-radius: 5px; 
                font-weight: bold;
                display: inline-block;">
        Verify Email Address
      </a>
    </div>
    
    <p style="color: #666; font-size: 14px;">
      If the button doesn't work, copy and paste this link into your browser:
      <br>
      <a href="${verificationUrl}" style="color: #667eea; word-break: break-all;">${verificationUrl}</a>
    </p>
    
    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
    
    <p style="color: #999; font-size: 12px; margin-bottom: 0;">
      This verification link will expire in 24 hours. If you didn't request this, you can safely ignore this email.
    </p>
  </div>
</body>
</html>
    `.trim();
  }

  private getVerificationEmailText(email: string, verificationUrl: string): string {
    return `
SQDIS - Verify Your Email Address

You've requested to add ${email} as an email alias to your SQDIS account.

Click the link below to verify this email address:
${verificationUrl}

This verification link will expire in 24 hours.

If you didn't request this, you can safely ignore this email.
    `.trim();
  }
}
