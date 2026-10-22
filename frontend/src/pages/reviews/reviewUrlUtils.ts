export interface ReviewLinkMetadata {
  prUrl?: string | null;
  pullRequestId?: string | number | null;
  prNumber?: string | number | null;
  repository?: {
    url?: string | null;
    fullName?: string | null;
    name?: string | null;
  } | null;
}

/**
 * Resolves the display name for a repository associated with a review.
 * Returns the full name or short name, defaulting to neutral 'Repository'
 * if no repository metadata exists.
 */
export function resolveRepositoryDisplayName(review?: ReviewLinkMetadata | null): string {
  if (!review?.repository) {
    return 'Repository';
  }
  return review.repository.fullName || review.repository.name || 'Repository';
}

/**
 * Dynamically resolves the GitHub/VCS pull request URL for a review item.
 * Prioritizes review.prUrl, then repository.url + /pull/{prNum}, then
 * https://github.com/{fullName}/pull/{prNum}. Returns empty string if
 * insufficient metadata is available.
 */
export function resolvePullRequestUrl(review?: ReviewLinkMetadata | null): string {
  if (!review) {
    return '';
  }

  if (review.prUrl && review.prUrl.trim().length > 0) {
    return review.prUrl.trim();
  }

  const prNum = review.pullRequestId ?? review.prNumber;
  if (prNum === null || prNum === undefined || String(prNum).trim().length === 0) {
    return '';
  }

  const cleanedPrNum = String(prNum).trim();

  if (review.repository?.url && review.repository.url.trim().length > 0) {
    const baseUrl = review.repository.url.trim().replace(/\/+$/, '');
    return `${baseUrl}/pull/${cleanedPrNum}`;
  }

  if (review.repository?.fullName && review.repository.fullName.trim().length > 0) {
    const fullName = review.repository.fullName.trim().replace(/^\/+|\/+$/g, '');
    return `https://github.com/${fullName}/pull/${cleanedPrNum}`;
  }

  return '';
}
