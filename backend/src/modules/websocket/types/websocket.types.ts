/**
 * WebSocket event types and interfaces
 */

/**
 * Authenticated socket with user context
 */
export interface AuthenticatedSocket {
  id: string;
  userId: string;
  email: string;
  name: string;
  organizationId?: string;
  role?: string;
  subscribedChannels: Set<string>;
}

/**
 * Client → Server events
 */
export interface ClientToServerEvents {
  'subscribe:dashboard': (data: { orgId: string }) => void;
  'subscribe:team': (data: { teamId: string }) => void;
  'subscribe:developer': (data: { developerId: string }) => void;
  unsubscribe: (data: { channel: string }) => void;
}

/**
 * Server → Client events
 */
export interface ServerToClientEvents {
  'commit:new': (data: CommitNewEvent) => void;
  'score:updated': (data: ScoreUpdatedEvent) => void;
  'alert:new': (data: AlertNewEvent) => void;
  'notification:new': (data: NotificationNewEvent) => void;
  'pr_quality_gate_evaluated': (data: QualityGateEvaluatedWsEvent) => void;
  error: (data: { message: string; code?: string }) => void;
  subscribed: (data: { channel: string }) => void;
  unsubscribed: (data: { channel: string }) => void;
}

/**
 * Event payload for new commits
 */
export interface CommitNewEvent {
  commitId: string;
  repoId: string;
  author: string;
  classification: string;
  message?: string;
  timestamp?: string;
}

/**
 * Event payload for score updates
 */
export interface ScoreUpdatedEvent {
  entityType: 'developer' | 'project';
  entityId: string;
  oldScore: number;
  newScore: number;
  scoreType?: 'dqs' | 'sqs';
}

/**
 * Event payload for new alerts
 */
export interface AlertNewEvent {
  alertId: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  type?: string;
  commitId?: string;
}

/**
 * Event payload for pull request quality gate evaluations
 */
export interface QualityGateEvaluatedWsEvent {
  evaluationId: string;
  pullRequestId: string;
  repositoryId: string;
  organizationId: string;
  prNumber: number;
  status: string;
  defectProbability: number;
  riskLevel: string;
  maxComplexity: number;
  headCommitSha: string;
  githubStatusState: string;
  summaryMarkdown: string;
  createdAt: string;
}

/**
 * Event payload for new notifications
 */
export interface NotificationNewEvent {
  notificationId: string;
  type: string;
  message: string;
  createdAt?: string;
}

/**
 * Channel types for subscription management
 */
export type ChannelType = 'dashboard' | 'team' | 'developer';

/**
 * Channel subscription data
 */
export interface ChannelSubscription {
  type: ChannelType;
  id: string;
  socketId: string;
  userId: string;
  subscribedAt: Date;
}
