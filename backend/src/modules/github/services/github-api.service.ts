import { Injectable, Logger } from '@nestjs/common';
import { Octokit } from '@octokit/rest';
import { GitHubCommitDetail, GitHubFileChange } from '../../commits/types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

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

  /**
   * Fetch code files from the default branch of a repository
   *
   * @param octokit - Authenticated Octokit instance
   * @param owner - Repository owner
   * @param repo - Repository name
   * @param maxFiles - Maximum number of files to retrieve (default: 40)
   * @returns Array of path and base64-decoded content of files
   */
  async fetchRepositoryCodeFiles(
    octokit: Octokit,
    owner: string,
    repo: string,
    maxFiles = 40,
  ): Promise<Array<{ path: string; content: string }>> {
    this.logger.debug(`Fetching repository code files for ${owner}/${repo}`);
    try {
      // 1. Get repository info to find default branch
      const { data: repoInfo } = await octokit.rest.repos.get({
        owner,
        repo,
      });
      const defaultBranch = repoInfo.default_branch || 'main';

      // Attempt tarball download and native tar command extraction
      try {
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-repo-'));
        const tarPath = path.join(tempDir, 'repo.tar.gz');
        const extractDir = path.join(tempDir, 'extracted');
        fs.mkdirSync(extractDir);

        this.logger.debug(`Downloading tarball for ${owner}/${repo}@${defaultBranch} to ${tarPath}`);
        const response = await octokit.rest.repos.downloadTarballArchive({
          owner,
          repo,
          ref: defaultBranch,
        });

        const buffer = Buffer.from(response.data as ArrayBuffer);
        fs.writeFileSync(tarPath, buffer);

        this.logger.debug(`Extracting tarball ${tarPath} to ${extractDir}`);
        execSync(`tar -xf "${tarPath}" -C "${extractDir}"`);

        const allowedExtensions = /\.(ts|tsx|js|jsx|py|go|java|cpp|c|rb|php|cs)$/i;
        const ignoredPaths = /(node_modules|dist|build|\.git|\.github|vendor|__pycache__|tests|test|docs|mocks|mock|package-lock\.json|yarn\.lock|pnpm-lock\.yaml)/i;

        const results: Array<{ path: string; content: string }> = [];

        const readDirRecursive = (dir: string) => {
          const items = fs.readdirSync(dir);
          for (const item of items) {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
              readDirRecursive(fullPath);
            } else {
              const relPath = path.relative(extractDir, fullPath).replace(/\\/g, '/');
              const parts = relPath.split('/');
              if (parts.length > 1) {
                const repoPath = parts.slice(1).join('/');
                if (allowedExtensions.test(repoPath) && !ignoredPaths.test(repoPath)) {
                  results.push({
                    path: repoPath,
                    content: fs.readFileSync(fullPath, 'utf8'),
                  });
                }
              }
            }
          }
        };

        readDirRecursive(extractDir);

        try {
          fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (cleanupErr) {
          this.logger.warn(`Failed to clean up temp dir ${tempDir}: ${cleanupErr}`);
        }

        const selectedFiles = results.slice(0, maxFiles);
        this.logger.log(`Successfully fetched and extracted ${selectedFiles.length} files from tarball archive`);
        return selectedFiles;
      } catch (tarError) {
        this.logger.warn(`Tarball-based extraction failed: ${tarError}. Falling back to sequential git blob API queries...`);
      }

      // Fallback: Get the latest commit of the default branch to find the root tree
      const { data: branchInfo } = await octokit.rest.repos.getBranch({
        owner,
        repo,
        branch: defaultBranch,
      });
      const treeSha = branchInfo.commit.commit.tree.sha;

      // Get tree recursively
      const { data: treeInfo } = await octokit.rest.git.getTree({
        owner,
        repo,
        tree_sha: treeSha,
        recursive: 'true',
      });

      // Filter for relevant source code files
      const allowedExtensions = /\.(ts|tsx|js|jsx|py|go|java|cpp|c|rb|php|cs)$/i;
      const ignoredPaths = /(node_modules|dist|build|\.git|\.github|vendor|__pycache__|tests|test|docs|mocks|mock|package-lock\.json|yarn\.lock|pnpm-lock\.yaml)/i;

      const codeFiles = (treeInfo.tree || []).filter(
        (item) =>
          item.type === 'blob' &&
          item.path &&
          allowedExtensions.test(item.path) &&
          !ignoredPaths.test(item.path),
      );

      const selectedFiles = codeFiles.slice(0, maxFiles);
      this.logger.debug(
        `Selected ${selectedFiles.length} files from ${owner}/${repo} for initial AST analysis`,
      );

      const results: Array<{ path: string; content: string }> = [];

      for (const file of selectedFiles) {
        if (!file.sha || !file.path) continue;
        try {
          const { data: blob } = await octokit.rest.git.getBlob({
            owner,
            repo,
            file_sha: file.sha,
          });

          const content = Buffer.from(blob.content, 'base64').toString('utf8');
          results.push({
            path: file.path,
            content,
          });
        } catch (fileErr) {
          this.logger.warn(`Failed to fetch blob for ${file.path}: ${fileErr}`);
        }
      }

      return results;
    } catch (error) {
      this.logger.error(`Failed to fetch repository code files for ${owner}/${repo}: ${error}`);
      return [];
    }
  }
}
