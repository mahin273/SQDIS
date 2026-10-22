import { describe, it, expect } from 'vitest';
import { resolveRepositoryDisplayName, resolvePullRequestUrl } from './reviewUrlUtils';

describe('reviewUrlUtils', () => {
  describe('resolveRepositoryDisplayName', () => {
    it('returns repository.fullName when available', () => {
      const result = resolveRepositoryDisplayName({
        repository: { fullName: 'acme/analytics-api', name: 'analytics-api' },
      });
      expect(result).toBe('acme/analytics-api');
    });

    it('returns repository.name when fullName is absent', () => {
      const result = resolveRepositoryDisplayName({
        repository: { fullName: '', name: 'analytics-api' },
      });
      expect(result).toBe('analytics-api');
    });

    it('returns neutral fallback "Repository" when repository is missing or null', () => {
      expect(resolveRepositoryDisplayName(null)).toBe('Repository');
      expect(resolveRepositoryDisplayName(undefined)).toBe('Repository');
      expect(resolveRepositoryDisplayName({ repository: null })).toBe('Repository');
    });
  });

  describe('resolvePullRequestUrl', () => {
    it('returns explicit prUrl when present', () => {
      const result = resolvePullRequestUrl({
        prUrl: 'https://gitlab.com/enterprise/project/-/merge_requests/42',
        pullRequestId: '42',
      });
      expect(result).toBe('https://gitlab.com/enterprise/project/-/merge_requests/42');
    });

    it('builds PR URL from repository.url and pullRequestId stripping trailing slash', () => {
      const result = resolvePullRequestUrl({
        pullRequestId: 128,
        repository: { url: 'https://github.com/my-org/my-repo/' },
      });
      expect(result).toBe('https://github.com/my-org/my-repo/pull/128');
    });

    it('builds PR URL from repository.fullName when repository.url is absent', () => {
      const result = resolvePullRequestUrl({
        prNumber: 99,
        repository: { fullName: 'my-org/custom-repo' },
      });
      expect(result).toBe('https://github.com/my-org/custom-repo/pull/99');
    });

    it('returns empty string if prNum is missing', () => {
      const result = resolvePullRequestUrl({
        repository: { fullName: 'my-org/custom-repo' },
      });
      expect(result).toBe('');
    });

    it('returns empty string if review is null or undefined', () => {
      expect(resolvePullRequestUrl(null)).toBe('');
      expect(resolvePullRequestUrl(undefined)).toBe('');
    });

    it('returns empty string if repository metadata is absent and no prUrl exists', () => {
      const result = resolvePullRequestUrl({
        pullRequestId: 42,
        repository: null,
      });
      expect(result).toBe('');
    });
  });
});
