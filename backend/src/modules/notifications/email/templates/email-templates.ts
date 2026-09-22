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
      margin: 0;
      padding: 0;
      background-color: #f8fafc;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      color: #334155;
      line-height: 1.6;
    }
    table {
      border-collapse: collapse;
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }
    td {
      padding: 0;
    }
    .wrapper {
      width: 100%;
      background-color: #f8fafc;
      padding: 32px 12px;
    }
    .card {
      max-width: 560px;
      margin: 0 auto;
      background-color: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(15, 23, 42, 0.05), 0 2px 4px -2px rgba(15, 23, 42, 0.05);
    }
    .header-bar {
      padding: 24px 32px;
      border-bottom: 1px solid #f1f5f9;
      background-color: #ffffff;
    }
    .content-body {
      padding: 32px 32px 28px;
    }
    .cta-button {
      display: inline-block;
      background-color: #2563eb;
      color: #ffffff !important;
      text-decoration: none;
      padding: 13px 32px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 14px;
      text-align: center;
    }
    .footer-bar {
      padding: 24px 32px;
      background-color: #fafbfc;
      border-top: 1px solid #f1f5f9;
      font-size: 12px;
      color: #64748b;
      line-height: 1.5;
      text-align: center;
    }
    .alert-box {
      padding: 16px 20px;
      margin: 20px 0;
      background-color: #f8fafc;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
    }
    .alert-critical { border-left: 4px solid #ef4444; }
    .alert-high { border-left: 4px solid #f97316; }
    .alert-medium { border-left: 4px solid #f59e0b; }
    .alert-low { border-left: 4px solid #10b981; }
    .code {
      background-color: #f1f5f9;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 13px;
      color: #0f172a;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td align="center">
          <div class="card">
            <div class="header-bar" align="left">
              <table cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="vertical-align: middle;">
                    <div style="background-color: #0f172a; color: #ffffff; font-weight: 800; font-size: 13px; letter-spacing: 0.08em; padding: 6px 12px; border-radius: 6px; display: inline-block; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">
                      SQDIS
                    </div>
                  </td>
                  <td style="vertical-align: middle; padding-left: 12px;">
                    <span style="font-size: 11px; font-weight: 700; color: #64748b; letter-spacing: 0.06em; text-transform: uppercase;">Software Quality Intelligence</span>
                  </td>
                </tr>
              </table>
            </div>
            <div class="content-body" align="left">
              ${content}
            </div>
            <div class="footer-bar">
              <p style="margin: 0 0 6px; font-weight: 500; color: #475569;">SQDIS Platform &bull; Software Quality &amp; Developer Intelligence System</p>
              <p style="margin: 0; color: #94a3b8; font-size: 11px;">Automated engineering metrics, quality gates, and code risk monitoring.</p>
            </div>
          </div>
        </td>
      </tr>
    </table>
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
    <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 700; color: #0f172a;">Verify Your Email Address</h2>
    <p style="margin: 0 0 16px; font-size: 15px; color: #334155;">Hi ${data.userName},</p>
    <p style="margin: 0 0 20px; font-size: 15px; color: #334155;">You requested to link <strong>${data.email}</strong> as an email alias to your SQDIS account.</p>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin: 28px 0 24px;">
      <tr>
        <td align="center">
          <a href="${data.verificationUrl}" class="cta-button" style="background-color: #2563eb; color: #ffffff !important; display: inline-block; padding: 13px 32px; border-radius: 8px; font-weight: 600; font-size: 14px; text-decoration: none;">
            Verify Email Address
          </a>
        </td>
      </tr>
    </table>
    <p style="font-size: 12px; color: #64748b; margin-top: 24px; margin-bottom: 6px;">
      Or copy and paste this link into your browser:
    </p>
    <div style="background-color: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; color: #2563eb; word-break: break-all;">
      ${data.verificationUrl}
    </div>
    <p style="font-size: 12px; color: #94a3b8; margin-top: 16px; margin-bottom: 0;">
      This link will expire in ${data.expiresIn}. Once verified, commits from this email address will be attributed to your account.
    </p>
  `;
  return baseTemplate(content, 'Verify Your Email - SQDIS');
};

/**
 * Organization invitation template
 * Send invitation with 7-day expiry
 */
export interface InvitationEmailData {
  inviterName: string;
  inviterEmail?: string;
  organizationName: string;
  invitationUrl: string;
  expiresIn: string;
  recipientEmail?: string;
  role?: string;
}

export const invitationEmailTemplate = (data: InvitationEmailData): string => {
  const isSameName =
    data.inviterName &&
    data.inviterName.trim().toLowerCase() === data.organizationName.trim().toLowerCase();

  const inviterDisplay = isSameName
    ? (data.inviterEmail ? `Team Administrator (${data.inviterEmail})` : 'Team Administrator')
    : `${data.inviterName}${data.inviterEmail ? ` (${data.inviterEmail})` : ''}`;

  const greetingSentence = isSameName
    ? `An administrator at <strong>${data.organizationName}</strong> has invited you to join the engineering workspace on <strong>SQDIS</strong>.`
    : `<strong>${data.inviterName}</strong>${data.inviterEmail ? ` (${data.inviterEmail})` : ''} has invited you to join the <strong>${data.organizationName}</strong> organization on <strong>SQDIS</strong>.`;

  const content = `
    <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 700; color: #0f172a; letter-spacing: -0.01em;">
      You're Invited to Join ${data.organizationName}
    </h2>
    <p style="margin: 0 0 16px; font-size: 15px; color: #334155; line-height: 1.6;">
      Hi there,
    </p>
    <p style="margin: 0 0 20px; font-size: 15px; color: #334155; line-height: 1.6;">
      ${greetingSentence}
    </p>

    <!-- Invitation Details Box -->
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin: 24px 0;">
      <tr>
        <td style="padding: 16px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
            <tr>
              <td style="padding: 6px 0; font-size: 13px; color: #64748b;">Organization</td>
              <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: #0f172a; text-align: right;">${data.organizationName}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-size: 13px; color: #64748b; border-top: 1px solid #edf2f7;">Invited by</td>
              <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: #0f172a; text-align: right;">${inviterDisplay}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-size: 13px; color: #64748b; border-top: 1px solid #edf2f7;">Assigned Role</td>
              <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: #2563eb; text-align: right;">${data.role || 'Developer'}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; font-size: 13px; color: #64748b; border-top: 1px solid #edf2f7;">Link Expiry</td>
              <td style="padding: 6px 0; font-size: 13px; font-weight: 600; color: #0f172a; text-align: right;">${data.expiresIn}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Call to action button -->
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin: 28px 0 24px;">
      <tr>
        <td align="center">
          <a href="${data.invitationUrl}" style="background-color: #2563eb; color: #ffffff !important; display: inline-block; padding: 13px 36px; border-radius: 8px; font-weight: 600; font-size: 14px; text-decoration: none; box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); text-align: center;">
            Accept Invitation &amp; Join Team
          </a>
        </td>
      </tr>
    </table>

    <!-- Feature highlights -->
    <div style="background-color: #fcfdfe; border: 1px solid #eef2f6; border-radius: 8px; padding: 16px 20px; margin: 24px 0 20px;">
      <p style="margin: 0 0 8px; font-size: 13px; font-weight: 600; color: #0f172a;">With SQDIS, your team can:</p>
      <table cellpadding="0" cellspacing="0" role="presentation" style="width: 100%;">
        <tr>
          <td style="padding: 4px 0; font-size: 13px; color: #475569; line-height: 1.5;">&bull; Monitor Developer Quality Scores (DQS) and Software Quality Scores (SQS)</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; font-size: 13px; color: #475569; line-height: 1.5;">&bull; Automate PR quality gates, test coverage analysis, and risk forecasts</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; font-size: 13px; color: #475569; line-height: 1.5;">&bull; Track sprint health, review debt, and developer velocity metrics</td>
        </tr>
      </table>
    </div>

    <!-- Direct URL -->
    <p style="font-size: 12px; color: #64748b; margin-top: 24px; margin-bottom: 6px;">
      If the button above does not work, copy and paste this URL into your browser:
    </p>
    <div style="background-color: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 14px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 12px; color: #2563eb; word-break: break-all;">
      ${data.invitationUrl}
    </div>

    <p style="font-size: 12px; color: #94a3b8; margin-top: 20px; margin-bottom: 0;">
      This link is unique to you and will expire in ${data.expiresIn}. If you were not expecting this invitation, you can safely disregard this email.
    </p>
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
    CRITICAL: '#ef4444',
    HIGH: '#f97316',
    MEDIUM: '#f59e0b',
    LOW: '#10b981',
  };

  const content = `
    <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 700; color: #0f172a;">[${data.severity} Alert] Anomaly Detected</h2>
    <p style="margin: 0 0 16px; font-size: 15px; color: #334155;">Hi ${data.userName},</p>
    <p style="margin: 0 0 16px; font-size: 15px; color: #334155;">An anomaly has been detected that requires your attention:</p>
    <div class="alert-box ${severityClass}">
      <h3 style="margin-top: 0; color: ${severityColors[data.severity]};">${data.alertTitle}</h3>
      <p style="margin: 8px 0; color: #334155;">${data.message}</p>
      ${data.repositoryName ? `<p style="margin: 4px 0; font-size: 13px;"><strong>Repository:</strong> ${data.repositoryName}</p>` : ''}
      ${data.commitSha ? `<p style="margin: 4px 0; font-size: 13px;"><strong>Commit:</strong> <span class="code">${data.commitSha.substring(0, 7)}</span></p>` : ''}
      <p style="margin: 4px 0; font-size: 13px;"><strong>Detected at:</strong> ${data.timestamp}</p>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin: 24px 0;">
      <tr>
        <td align="center">
          <a href="${data.alertUrl}" class="cta-button" style="background-color: #2563eb; color: #ffffff !important; display: inline-block; padding: 13px 32px; border-radius: 8px; font-weight: 600; font-size: 14px; text-decoration: none;">
            View Alert Details
          </a>
        </td>
      </tr>
    </table>
    <p style="font-size: 13px; color: #64748b;">Please review this alert and take appropriate action.</p>
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
    <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 700; color: #0f172a;">[Milestone Achieved] Great Progress!</h2>
    <p style="margin: 0 0 16px; font-size: 15px; color: #334155;">Hi ${data.mentorName},</p>
    <p style="margin: 0 0 16px; font-size: 15px; color: #334155;">Your team member <strong>${data.developerName}</strong> has achieved a milestone:</p>
    <div class="alert-box" style="border-left: 4px solid #10b981;">
      <h3 style="margin-top: 0; color: #10b981;">${data.milestoneType}</h3>
      <p style="margin: 8px 0; color: #334155;">${data.milestoneDescription}</p>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin: 24px 0;">
      <tr>
        <td align="center">
          <a href="${data.dashboardUrl}" class="cta-button" style="background-color: #2563eb; color: #ffffff !important; display: inline-block; padding: 13px 32px; border-radius: 8px; font-weight: 600; font-size: 14px; text-decoration: none;">
            View Progress
          </a>
        </td>
      </tr>
    </table>
    <p style="font-size: 13px; color: #64748b;">Keep up the great mentoring work!</p>
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
    <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 700; color: #0f172a;">[Goal Achieved] Congratulations!</h2>
    <p style="margin: 0 0 16px; font-size: 15px; color: #334155;">Hi ${data.userName},</p>
    <p style="margin: 0 0 16px; font-size: 15px; color: #334155;">Congratulations! You have achieved your goal:</p>
    <div class="alert-box" style="border-left: 4px solid #10b981;">
      <h3 style="margin-top: 0; color: #10b981;">${data.goalName}</h3>
      <p style="margin: 8px 0; color: #334155;">${data.goalDescription}</p>
      <p style="margin: 4px 0; font-size: 13px; color: #64748b;"><strong>Achieved on:</strong> ${data.achievedAt}</p>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin: 24px 0;">
      <tr>
        <td align="center">
          <a href="${data.dashboardUrl}" class="cta-button" style="background-color: #2563eb; color: #ffffff !important; display: inline-block; padding: 13px 32px; border-radius: 8px; font-weight: 600; font-size: 14px; text-decoration: none;">
            View Dashboard
          </a>
        </td>
      </tr>
    </table>
    <p style="font-size: 13px; color: #64748b;">Keep up the excellent work!</p>
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
    <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 700; color: #0f172a;">[Sprint Report] Report Ready</h2>
    <p style="margin: 0 0 16px; font-size: 15px; color: #334155;">Hi ${data.teamLeadName},</p>
    <p style="margin: 0 0 16px; font-size: 15px; color: #334155;">The sprint report for <strong>${data.sprintName}</strong> (${data.teamName}) is now available.</p>
    <div class="alert-box">
      <h3 style="margin-top: 0; color: #0f172a;">Sprint Summary</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; font-size: 13px; color: #64748b;"><strong>Total Commits:</strong></td>
          <td style="padding: 8px 0; font-size: 13px; font-weight: 600; color: #0f172a; text-align: right;">${data.summary.totalCommits}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-size: 13px; color: #64748b; border-top: 1px solid #edf2f7;"><strong>Bugs Fixed:</strong></td>
          <td style="padding: 8px 0; font-size: 13px; font-weight: 600; color: #0f172a; text-align: right;">${data.summary.bugsFixed}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-size: 13px; color: #64748b; border-top: 1px solid #edf2f7;"><strong>Features Delivered:</strong></td>
          <td style="padding: 8px 0; font-size: 13px; font-weight: 600; color: #0f172a; text-align: right;">${data.summary.featuresDelivered}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; font-size: 13px; color: #64748b; border-top: 1px solid #edf2f7;"><strong>Average DQS:</strong></td>
          <td style="padding: 8px 0; font-size: 13px; font-weight: 600; color: #2563eb; text-align: right;">${data.summary.averageDqs.toFixed(1)}</td>
        </tr>
      </table>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin: 24px 0;">
      <tr>
        <td align="center">
          <a href="${data.reportUrl}" class="cta-button" style="background-color: #2563eb; color: #ffffff !important; display: inline-block; padding: 13px 32px; border-radius: 8px; font-weight: 600; font-size: 14px; text-decoration: none;">
            View Full Report
          </a>
        </td>
      </tr>
    </table>
  `;
  return baseTemplate(content, 'Sprint Report Ready - SQDIS');
};

