import { Injectable, Logger } from '@nestjs/common';
import { Octokit } from '@octokit/rest';
import { GitHubCommitDetail, GitHubFileChange } from '../../commits/types';

/**
 * Service for interacting with GitHub API
 */
@Injectable()
export class GitHubApiService {
  private readonly logger = new Logger(GitHubApiService.name);

  /**
   * Fetch detailed commit information from GitHub API
   *
   * @param octokit - Authenticated Octokit instance
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param sha - Commit SHA
   * @returns Detailed commit information including file changes
   */
  async fetchCommitDetails(
    octokit: Octokit,
    owner: string,
    repo: string,
    sha: string,
  ): Promise<GitHubCommitDetail> {
    this.logger.debug(`Fetching commit details for ${owner}/${repo}@${sha}`);

    try {
      const response = await octokit.rest.repos.getCommit({
        owner,
        repo,
        ref: sha,
      });

      const { data } = response;

      const commitDetail: GitHubCommitDetail = {
        sha: data.sha,
        commit: {
          message: data.commit.message,
          author: {
            name: data.commit.author?.name || 'Unknown',
            email: data.commit.author?.email || 'unknown@unknown.com',
            date: data.commit.author?.date || new Date().toISOString(),
          },
          committer: {
            name: data.commit.committer?.name || 'Unknown',
            email: data.commit.committer?.email || 'unknown@unknown.com',
            date: data.commit.committer?.date || new Date().toISOString(),
          },
        },
        stats: {
          additions: data.stats?.additions || 0,
          deletions: data.stats?.deletions || 0,
          total: data.stats?.total || 0,
        },
        files: (data.files || []).map(
          (file): GitHubFileChange => ({
            sha: file.sha || '',
            filename: file.filename,
            status: file.status,
            additions: file.additions,
            deletions: file.deletions,
            changes: file.changes,
            patch: file.patch,
            previous_filename: file.previous_filename,
          }),
        ),
      };

      this.logger.debug(
        `Fetched commit ${sha}: ${commitDetail.stats.additions}+ ${commitDetail.stats.deletions}- in ${commitDetail.files.length} files`,
      );

      return commitDetail;
    } catch (error) {
      this.logger.error(`Failed to fetch commit ${sha}: ${error}`);
      throw error;
    }
  }

  /**
   * Fetch commits for a repository within a date range
   *
   * @param octokit - Authenticated Octokit instance
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param since - Start date for commits
   * @param until - End date for commits (optional)
   * @returns Array of commit SHAs
   */
  async fetchCommitsSince(
    octokit: Octokit,
    owner: string,
    repo: string,
    since: Date,
    until?: Date,
  ): Promise<string[]> {
    this.logger.debug(`Fetching commits for ${owner}/${repo} since ${since.toISOString()}`);

    try {
      const commits = await octokit.paginate(octokit.rest.repos.listCommits, {
        owner,
        repo,
        since: since.toISOString(),
        until: until?.toISOString(),
        per_page: 100,
      });

      const shas = commits.map((commit) => commit.sha);
      this.logger.debug(`Found ${shas.length} commits since ${since.toISOString()}`);

      return shas;
    } catch (error) {
      this.logger.error(`Failed to fetch commits: ${error}`);
      throw error;
    }
  }
}
