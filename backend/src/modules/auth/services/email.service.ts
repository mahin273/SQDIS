/* eslint-disable */
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService }  from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import {Transporter} from 'nodemailer';

/**
 * Service for sending password reset email using SMTP configuration
 */
@Injectable()
export class EmailService{
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter;

  constructor(private readonly configService:ConfigService){
    this.transporter = nodemailer.createTransport({
      host:this.configService.get<string>('SMTP_HOST'),
      port:this.configService.get<number>('SMTP_PORT'),
      secure: this.configService.get<number>('SMTP_PORT') === 465,
      auth:{
        user:this.configService.get<string>('SMTP_USER'),
        pass:this.configService.get<string>('SMTP_PASS'),
      },
    });
  }

  /**
   * Generate plain text email template for password reset
   * @param resetUrl - The password reset URL
   * @param userName - The user's name
   * @returns Plain text email content
   */
  private getPasswordResetTemplate(resetUrl: string, userName:string):string{
    return `
    <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset Request</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
            <h2 style="color: #2c3e50; margin-top: 0;">Password Reset Request</h2>
            <p>Hello ${userName},</p>
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Reset Password</a>
            </div>
            <p style="color: #e74c3c; font-weight: bold;">This link will expire in 15 minutes.</p>
            <p>If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #007bff;">${resetUrl}</p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
            <p style="font-size: 12px; color: #666;">This is an automated message, please do not reply to this email.</p>
          </div>
        </body>
      </html>
    `;
  }
   /**
   * Generate plain text email template for password reset
   * @param resetUrl - The password reset URL
   * @param userName - The user's name
   * @returns Plain text email content
   */
  private getPasswordResetTextTemplate(resetUrl:string,userName:string):string{
    return `
Password Reset Request

Hello ${userName},

We received a request to reset your password. Click the link below to create a new password:

${resetUrl}

This link will expire in 15 minutes.

If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.

---
This is an automated message, please do not reply to this email.
    `.trim();
  }

}
