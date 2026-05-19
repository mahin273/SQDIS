import { GitHubFileChange, FileChangeData } from '../types';

/**
 * Utility for parsing Git diffs and extracting file change metrics
 */

/**
 * Parse GitHub file changes into FileChangeData with churn ratio
 *
 * @param files - Array of GitHub file changes from API
 * @returns Array of FileChangeData with calculated churn ratios
 */
export function parseFileChanges(files: GitHubFileChange[]): FileChangeData[] {
  return files.map((file) => ({
    filePath: file.filename,
    additions: file.additions,
    deletions: file.deletions,
    churnRatio: calculateFileChurnRatio(file.additions, file.deletions),
  }));
}

/**
 * Calculate churn ratio for a single file
 * Churn ratio = (additions + deletions) / max(1, additions + deletions)
 * This gives a normalized value representing the intensity of changes
 *
 *
 * @param additions - Number of lines added
 * @param deletions - Number of lines deleted
 * @returns Churn ratio (always >= 0)
 */
export function calculateFileChurnRatio(additions: number, deletions: number): number {
  const totalChanges = additions + deletions;
  // For a single file, churn ratio is simply the total changes
  // normalized by itself (which is 1 if there are changes, 0 otherwise)
  // This represents the "intensity" of changes in the file
  return totalChanges > 0 ? 1.0 : 0.0;
}

/**
 * Calculate overall churn ratio for a commit
 * Churn ratio = (total_additions + total_deletions) / total_lines_in_repo
 * Since we don't have total LOC, we use a simplified formula:
 * churn_ratio = (additions + deletions) / max(1, additions)
 *
 *
 * @param additions - Total lines added in commit
 * @param deletions - Total lines deleted in commit
 * @returns Churn ratio (always >= 0)
 */
export function calculateCommitChurnRatio(additions: number, deletions: number): number {
  // Ensure non-negative inputs
  const safeAdditions = Math.max(0, additions);
  const safeDeletions = Math.max(0, deletions);

  const totalChanges = safeAdditions + safeDeletions;

  if (totalChanges === 0) {
    return 0;
  }

  // Churn ratio: deletions relative to total changes
  // Higher ratio means more deletions relative to additions (more "churn")
  // Range: 0 (all additions) to 1 (all deletions)
  return safeDeletions / totalChanges;
}

/**
 * Parse a unified diff patch to extract line-by-line changes
 * This is useful for more detailed analysis of what changed
 *
 * @param patch - Unified diff patch string
 * @returns Object with added and removed line counts
 */
export function parseDiffPatch(patch: string | undefined): {
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
} {
  if (!patch) {
    return { additions: 0, deletions: 0, hunks: [] };
  }

  const lines = patch.split('\n');
  let additions = 0;
  let deletions = 0;
  const hunks: DiffHunk[] = [];
  let currentHunk: DiffHunk | null = null;

  for (const line of lines) {
    // Hunk header: @@ -start,count +start,count @@
    if (line.startsWith('@@')) {
      if (currentHunk) {
        hunks.push(currentHunk);
      }
      const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
      if (match) {
        currentHunk = {
          oldStart: parseInt(match[1], 10),
          oldLines: parseInt(match[2] || '1', 10),
          newStart: parseInt(match[3], 10),
          newLines: parseInt(match[4] || '1', 10),
          changes: [],
        };
      }
      continue;
    }

    if (currentHunk) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        additions++;
        currentHunk.changes.push({ type: 'add', content: line.substring(1) });
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        deletions++;
        currentHunk.changes.push({ type: 'delete', content: line.substring(1) });
      } else if (line.startsWith(' ')) {
        currentHunk.changes.push({ type: 'context', content: line.substring(1) });
      }
    }
  }

  if (currentHunk) {
    hunks.push(currentHunk);
  }

  return { additions, deletions, hunks };
}

/**
 * Represents a hunk in a unified diff
 */
export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  changes: DiffChange[];
}

/**
 * Represents a single line change in a diff
 */
export interface DiffChange {
  type: 'add' | 'delete' | 'context';
  content: string;
}

/**
 * Aggregate file changes to get commit-level statistics
 *
 * @param fileChanges - Array of file change data
 * @returns Aggregated statistics
 */
export function aggregateFileChanges(fileChanges: FileChangeData[]): {
  totalAdditions: number;
  totalDeletions: number;
  totalFiles: number;
  averageChurnRatio: number;
} {
  const totalAdditions = fileChanges.reduce((sum, f) => sum + f.additions, 0);
  const totalDeletions = fileChanges.reduce((sum, f) => sum + f.deletions, 0);
  const totalFiles = fileChanges.length;

  const averageChurnRatio =
    totalFiles > 0 ? fileChanges.reduce((sum, f) => sum + f.churnRatio, 0) / totalFiles : 0;

  return {
    totalAdditions,
    totalDeletions,
    totalFiles,
    averageChurnRatio,
  };
}
