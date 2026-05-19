import { ParsedCommitData } from '../../github/dto/webhook-payload.dto';

/**
 * Job data for commit processing
 */
export interface CommitJobData {
  type: 'process_commit';
  commit: ParsedCommitData;
  repositoryId: string;
  organizationId: string;
}

/**
 * File change data extracted from commit diff
 */
export interface FileChangeData {
  filePath: string;
  additions: number;
  deletions: number;
  churnRatio: number;
}

/**
 * Processed commit result
 */
export interface ProcessedCommitResult {
  commitId: string;
  sha: string;
  linesAdded: number;
  linesDeleted: number;
  filesChanged: number;
  churnRatio: number;
  fileChanges: FileChangeData[];
  developerId: string | null;
  classification: string | null;
}

/**
 * GitHub commit detail from API
 */
export interface GitHubCommitDetail {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      email: string;
      date: string;
    };
    committer: {
      name: string;
      email: string;
      date: string;
    };
  };
  stats: {
    additions: number;
    deletions: number;
    total: number;
  };
  files: GitHubFileChange[];
}

/**
 * GitHub file change from API
 */
export interface GitHubFileChange {
  sha: string;
  filename: string;
  status: 'added' | 'removed' | 'modified' | 'renamed' | 'copied' | 'changed' | 'unchanged';
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  previous_filename?: string;
}
