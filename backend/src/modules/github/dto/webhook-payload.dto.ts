/**
 * GitHub Webhook Payload DTOs
 */

/**
 * GitHub User in webhook payloads
 */
export interface GitHubUser {
  id: number;
  login: string;
  email?: string;
  name?: string;
  avatar_url?: string;
}

/**
 * GitHub Repository in webhook payloads
 */
export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  owner: GitHubUser;
}

/**
 * GitHub Commit Author
 */
export interface GitHubCommitAuthor {
  name: string;
  email: string;
  username?: string;
}

/**
 * GitHub Commit in push event
 */
export interface GitHubCommit {
  id: string;
  tree_id: string;
  distinct: boolean;
  message: string;
  timestamp: string;
  url: string;
  author: GitHubCommitAuthor;
  committer: GitHubCommitAuthor;
  added: string[];
  removed: string[];
  modified: string[];
}

/**
 * Push event payload from GitHub webhook
 */
export interface PushEventPayload {
  ref: string;
  before: string;
  after: string;
  repository: GitHubRepository;
  pusher: {
    name: string;
    email: string;
  };
  sender: GitHubUser;
  created: boolean;
  deleted: boolean;
  forced: boolean;
  base_ref: string | null;
  compare: string;
  commits: GitHubCommit[];
  head_commit: GitHubCommit | null;
}

/**
 * Pull Request in webhook payloads
 */
export interface GitHubPullRequest {
  id: number;
  number: number;
  state: 'open' | 'closed';
  title: string;
  body: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  merged_at: string | null;
  merge_commit_sha: string | null;
  user: GitHubUser;
  head: {
    ref: string;
    sha: string;
    repo: GitHubRepository;
  };
  base: {
    ref: string;
    sha: string;
    repo: GitHubRepository;
  };
}

/**
 * Pull Request Review in webhook payloads
 */
export interface GitHubReview {
  id: number;
  user: GitHubUser;
  body: string | null;
  state: 'approved' | 'changes_requested' | 'commented' | 'dismissed' | 'pending';
  submitted_at: string;
  commit_id: string;
  html_url: string;
}

/**
 * Pull Request Review event payload from GitHub webhook
 */
export interface PullRequestReviewEventPayload {
  action: 'submitted' | 'edited' | 'dismissed';
  review: GitHubReview;
  pull_request: GitHubPullRequest;
  repository: GitHubRepository;
  sender: GitHubUser;
}

/**
 * Pull Request Review Comment in webhook payloads
 */
export interface GitHubReviewComment {
  id: number;
  pull_request_review_id: number;
  diff_hunk: string;
  path: string;
  position: number | null;
  original_position: number | null;
  commit_id: string;
  original_commit_id: string;
  in_reply_to_id?: number;
  user: GitHubUser;
  body: string;
  created_at: string;
  updated_at: string;
  html_url: string;
  line: number | null;
  original_line: number | null;
  start_line: number | null;
  original_start_line: number | null;
  side: 'LEFT' | 'RIGHT';
  start_side: 'LEFT' | 'RIGHT' | null;
}

/**
 * Pull Request Review Comment event payload from GitHub webhook
 */
export interface PullRequestReviewCommentEventPayload {
  action: 'created' | 'edited' | 'deleted';
  comment: GitHubReviewComment;
  pull_request: GitHubPullRequest;
  repository: GitHubRepository;
  sender: GitHubUser;
}

/**
 * Pull Request event payload from GitHub webhook
 */
export interface PullRequestEventPayload {
  action:
    | 'opened'
    | 'closed'
    | 'reopened'
    | 'edited'
    | 'synchronize'
    | 'assigned'
    | 'unassigned'
    | 'labeled'
    | 'unlabeled'
    | 'review_requested'
    | 'review_request_removed';
  number: number;
  pull_request: GitHubPullRequest;
  repository: GitHubRepository;
  sender: GitHubUser;
  requested_reviewer?: GitHubUser;
}

/**
 * Union type for all supported webhook payloads
 */
export type WebhookPayload =
  | PushEventPayload
  | PullRequestReviewEventPayload
  | PullRequestReviewCommentEventPayload
  | PullRequestEventPayload;

/**
 * Parsed commit data for processing
 */
export interface ParsedCommitData {
  sha: string;
  message: string;
  timestamp: Date;
  authorName: string;
  authorEmail: string;
  committerName: string;
  committerEmail: string;
  filesAdded: string[];
  filesRemoved: string[];
  filesModified: string[];
  repositoryId: number;
  repositoryFullName: string;
  forced: boolean;
}

/**
 * Parsed review data for processing
 */
export interface ParsedReviewData {
  reviewId: number;
  reviewerLogin: string;
  reviewerId: number;
  reviewerEmail?: string;
  state: string;
  body: string | null;
  submittedAt: Date;
  commitId: string;
  pullRequestNumber: number;
  pullRequestTitle: string;
  pullRequestCreatedAt: Date;
  repositoryId: number;
  repositoryFullName: string;
}

/**
 * Parsed review comment data for processing
 */
export interface ParsedReviewCommentData {
  commentId: number;
  reviewId: number;
  authorLogin: string;
  authorId: number;
  authorEmail?: string;
  body: string;
  filePath: string;
  lineNumber: number | null;
  diffHunk: string;
  parentCommentId?: number;
  createdAt: Date;
  updatedAt: Date;
  pullRequestNumber: number;
  repositoryId: number;
  repositoryFullName: string;
}

/**
 * Parsed pull request data for processing
 */
export interface ParsedPullRequestData {
  prNumber: number;
  prId: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  merged: boolean;
  mergedAt: Date | null;
  authorLogin: string;
  authorId: number;
  baseBranch: string;
  headBranch: string;
  baseCommitSha: string;
  headCommitSha: string;
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
  repositoryId: number;
  repositoryFullName: string;
}

/**
 * GitHub Label in webhook payloads
 */
export interface GitHubLabel {
  id: number;
  name: string;
  color: string;
  description: string | null;
}

/**
 * GitHub Issue in webhook payloads
 */
export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  user: GitHubUser;
  labels: GitHubLabel[];
  assignees: GitHubUser[];
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

/**
 * Issue event payload from GitHub webhook
 */
export interface IssueEventPayload {
  action: 'opened' | 'closed' | 'reopened' | 'labeled' | 'unlabeled' | 'assigned' | 'unassigned';
  issue: GitHubIssue;
  repository: GitHubRepository;
  sender: GitHubUser;
  label?: GitHubLabel;
  assignee?: GitHubUser;
}

/**
 * Parsed issue data for processing
 */
export interface ParsedIssueData {
  issueNumber: number;
  issueId: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  authorLogin: string;
  authorId: number;
  labels: string[];
  assignees: string[];
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
  repositoryId: number;
  repositoryFullName: string;
}

/**
 * GitHub Release in webhook payloads
 */
export interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string | null;
  body: string | null;
  draft: boolean;
  prerelease: boolean;
  created_at: string;
  published_at: string | null;
  author: GitHubUser;
}

/**
 * Release event payload from GitHub webhook
 */
export interface ReleaseEventPayload {
  action: 'published' | 'created' | 'deleted' | 'edited';
  release: GitHubRelease;
  repository: GitHubRepository;
  sender: GitHubUser;
}

/**
 * Parsed release data for processing
 */
export interface ParsedReleaseData {
  releaseId: number;
  tagName: string;
  releaseName: string | null;
  body: string | null;
  isDraft: boolean;
  isPrerelease: boolean;
  authorLogin: string;
  authorId: number;
  createdAt: Date;
  publishedAt: Date | null;
  repositoryId: number;
  repositoryFullName: string;
}

/**
 * GitHub Commit Comment in webhook payloads
 */
export interface GitHubCommitComment {
  id: number;
  commit_id: string;
  body: string;
  path: string | null;
  position: number | null;
  line: number | null;
  user: GitHubUser;
  created_at: string;
  updated_at: string;
}

/**
 * Commit Comment event payload from GitHub webhook
 */
export interface CommitCommentEventPayload {
  action: 'created';
  comment: GitHubCommitComment;
  repository: GitHubRepository;
  sender: GitHubUser;
}

/**
 * Parsed commit comment data for processing
 */
export interface ParsedCommitCommentData {
  commentId: number;
  commitSha: string;
  body: string;
  filePath: string | null;
  lineNumber: number | null;
  authorLogin: string;
  authorId: number;
  createdAt: Date;
  repositoryId: number;
  repositoryFullName: string;
}
