/**
 * Email templates for SQDIS notifications
 */

/**
 * Base email template wrapper with consistent styling
 */
const baseTemplate = (content: string, title: string): string => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
      background-color: #f5f5f5;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .email-wrapper {
      background-color: #ffffff;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px 20px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .content {
      padding: 30px 20px;
    }
    .button {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white !important;
      text-decoration: none;
      padding: 12px 30px;
      border-radius: 6px;
      font-weight: 600;
      margin: 20px 0;
    }
    .button:hover {
      opacity: 0.9;
    }
    .footer {
      background-color: #f8f9fa;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #666;
    }
    .alert-critical { border-left: 4px solid #dc3545; }
    .alert-high { border-left: 4px solid #fd7e14; }
    .alert-medium { border-left: 4px solid #ffc107; }
    .alert-low { border-left: 4px solid #28a745; }
    .alert-box {
      padding: 15px;
      margin: 15px 0;
      background-color: #f8f9fa;
      border-radius: 4px;
    }
    .code {
      background-color: #f4f4f4;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: monospace;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="email-wrapper">
      <div class="header">
        <h1>SQDIS</h1>
      </div>
      <div class="content">
        ${content}
      </div>
      <div class="footer">
        <p>This email was sent by SQDIS - Software Quality & Developer Intelligence System</p>
        <p>If you didn't request this email, you can safely ignore it.</p>
      </div>
    </div>
  </div>
</body>
</html>
`;

/**
 * Email verification template
 * Send verification email with secure token
 */
export interface VerificationEmailData {
  userName: string;
  email: string;
  verificationUrl: string;
  expiresIn: string;
}

export const verificationEmailTemplate = (data: VerificationEmailData): string => {
  const content = `
    <h2>Verify Your Email Address</h2>
    <p>Hi ${data.userName},</p>
    <p>You've requested to add <strong>${data.email}</strong> as an email alias to your SQDIS account.</p>
    <p>Please click the button below to verify this email address:</p>
    <p style="text-align: center;">
      <a href="${data.verificationUrl}" class="button">Verify Email Address</a>
    </p>
    <p>Or copy and paste this link into your browser:</p>
    <p style="word-break: break-all; font-size: 14px; color: #666;">
      ${data.verificationUrl}
    </p>
    <p><strong>This link will expire in ${data.expiresIn}.</strong></p>
    <p>Once verified, commits from this email address will be attributed to your account.</p>
  `;
  return baseTemplate(content, 'Verify Your Email - SQDIS');
};

/**
 * Organization invitation template
 *Send invitation with 7-day expiry
 */
export interface InvitationEmailData {
  inviterName: string;
  organizationName: string;
  invitationUrl: string;
  expiresIn: string;
}

export const invitationEmailTemplate = (data: InvitationEmailData): string => {
  const content = `
    <h2>You're Invited to Join ${data.organizationName}</h2>
    <p>Hi there,</p>
    <p><strong>${data.inviterName}</strong> has invited you to join <strong>${data.organizationName}</strong> on SQDIS.</p>
    <p>SQDIS is a Software Quality & Developer Intelligence System that helps teams track and improve their code quality.</p>
    <p style="text-align: center;">
      <a href="${data.invitationUrl}" class="button">Accept Invitation</a>
    </p>
    <p>Or copy and paste this link into your browser:</p>
    <p style="word-break: break-all; font-size: 14px; color: #666;">
      ${data.invitationUrl}
    </p>
    <p><strong>This invitation will expire in ${data.expiresIn}.</strong></p>
  `;
  return baseTemplate(content, `Join ${data.organizationName} on SQDIS`);
};

/**
 * Alert notification template
 * Send email notification for HIGH/CRITICAL alerts
 */
export interface AlertEmailData {
  userName: string;
  alertTitle: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  commitSha?: string;
  repositoryName?: string;
  alertUrl: string;
  timestamp: string;
}

export const alertEmailTemplate = (data: AlertEmailData): string => {
  const severityClass = `alert-${data.severity.toLowerCase()}`;
  const severityColors: Record<string, string> = {
    CRITICAL: '#dc3545',
    HIGH: '#fd7e14',
    MEDIUM: '#ffc107',
    LOW: '#28a745',
  };

  const content = `
    <h2>🚨 ${data.severity} Alert Detected</h2>
    <p>Hi ${data.userName},</p>
    <p>An anomaly has been detected that requires your attention:</p>
    <div class="alert-box ${severityClass}">
      <h3 style="margin-top: 0; color: ${severityColors[data.severity]};">${data.alertTitle}</h3>
      <p>${data.message}</p>
      ${data.repositoryName ? `<p><strong>Repository:</strong> ${data.repositoryName}</p>` : ''}
      ${data.commitSha ? `<p><strong>Commit:</strong> <span class="code">${data.commitSha.substring(0, 7)}</span></p>` : ''}
      <p><strong>Detected at:</strong> ${data.timestamp}</p>
    </div>
    <p style="text-align: center;">
      <a href="${data.alertUrl}" class="button">View Alert Details</a>
    </p>
    <p>Please review this alert and take appropriate action.</p>
  `;
  return baseTemplate(content, `${data.severity} Alert - SQDIS`);
};

/**
 * Milestone achievement notification template
 * Send notification on milestone achievement
 */
export interface MilestoneEmailData {
  mentorName: string;
  developerName: string;
  milestoneType: string;
  milestoneDescription: string;
  dashboardUrl: string;
}

export const milestoneEmailTemplate = (data: MilestoneEmailData): string => {
  const content = `
    <h2>🎉 Milestone Achieved!</h2>
    <p>Hi ${data.mentorName},</p>
    <p>Great news! Your mentee <strong>${data.developerName}</strong> has achieved a milestone:</p>
    <div class="alert-box" style="border-left: 4px solid #28a745;">
      <h3 style="margin-top: 0; color: #28a745;">${data.milestoneType}</h3>
      <p>${data.milestoneDescription}</p>
    </div>
    <p style="text-align: center;">
      <a href="${data.dashboardUrl}" class="button">View Progress</a>
    </p>
    <p>Keep up the great mentoring work!</p>
  `;
  return baseTemplate(content, 'Milestone Achieved - SQDIS');
};

/**
 * Goal achievement notification template
 * Create achievement notification
 */
export interface GoalAchievementEmailData {
  userName: string;
  goalName: string;
  goalDescription: string;
  achievedAt: string;
  dashboardUrl: string;
}

export const goalAchievementEmailTemplate = (data: GoalAchievementEmailData): string => {
  const content = `
    <h2>🏆 Goal Achieved!</h2>
    <p>Hi ${data.userName},</p>
    <p>Congratulations! You've achieved your goal:</p>
    <div class="alert-box" style="border-left: 4px solid #28a745;">
      <h3 style="margin-top: 0; color: #28a745;">${data.goalName}</h3>
      <p>${data.goalDescription}</p>
      <p><strong>Achieved on:</strong> ${data.achievedAt}</p>
    </div>
    <p style="text-align: center;">
      <a href="${data.dashboardUrl}" class="button">View Dashboard</a>
    </p>
    <p>Keep up the excellent work!</p>
  `;
  return baseTemplate(content, 'Goal Achieved - SQDIS');
};

/**
 * Sprint report ready notification template
 */
export interface SprintReportEmailData {
  teamLeadName: string;
  sprintName: string;
  teamName: string;
  reportUrl: string;
  summary: {
    totalCommits: number;
    bugsFixed: number;
    featuresDelivered: number;
    averageDqs: number;
  };
}

export const sprintReportEmailTemplate = (data: SprintReportEmailData): string => {
  const content = `
    <h2>📊 Sprint Report Ready</h2>
    <p>Hi ${data.teamLeadName},</p>
    <p>The report for <strong>${data.sprintName}</strong> (${data.teamName}) is now available.</p>
    <div class="alert-box">
      <h3 style="margin-top: 0;">Sprint Summary</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0;"><strong>Total Commits:</strong></td>
          <td style="padding: 8px 0; text-align: right;">${data.summary.totalCommits}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0;"><strong>Bugs Fixed:</strong></td>
          <td style="padding: 8px 0; text-align: right;">${data.summary.bugsFixed}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0;"><strong>Features Delivered:</strong></td>
          <td style="padding: 8px 0; text-align: right;">${data.summary.featuresDelivered}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0;"><strong>Average DQS:</strong></td>
          <td style="padding: 8px 0; text-align: right;">${data.summary.averageDqs.toFixed(1)}</td>
        </tr>
      </table>
    </div>
    <p style="text-align: center;">
      <a href="${data.reportUrl}" class="button">View Full Report</a>
    </p>
  `;
  return baseTemplate(content, 'Sprint Report Ready - SQDIS');
};
