import {
  aggregateFileChanges,
  calculateCommitChurnRatio,
  parseDiffPatch,
  parseFileChanges,
} from './diff-parser.util';
import { FileChangeData, GitHubFileChange } from '../types';

describe('diff-parser utilities', () => {
  describe('parseFileChanges', () => {
    it('maps GitHub file changes to commit file metrics', () => {
      const files: GitHubFileChange[] = [
        {
          sha: 'abc123',
          filename: 'src/app.ts',
          status: 'modified',
          additions: 12,
          deletions: 3,
          changes: 15,
        },
        {
          sha: 'def456',
          filename: 'README.md',
          status: 'added',
          additions: 5,
          deletions: 0,
          changes: 5,
        },
      ];

      expect(parseFileChanges(files)).toEqual([
        {
          filePath: 'src/app.ts',
          additions: 12,
          deletions: 3,
          churnRatio: 1,
        },
        {
          filePath: 'README.md',
          additions: 5,
          deletions: 0,
          churnRatio: 1,
        },
      ]);
    });
  });

  describe('calculateCommitChurnRatio', () => {
    it.each([
      { additions: 10, deletions: 0, expected: 0 },
      { additions: 5, deletions: 5, expected: 0.5 },
      { additions: 0, deletions: 8, expected: 1 },
      { additions: -10, deletions: -3, expected: 0 },
    ])(
      'returns $expected for additions=$additions and deletions=$deletions',
      ({ additions, deletions, expected }) => {
        expect(calculateCommitChurnRatio(additions, deletions)).toBe(expected);
      },
    );
  });

  describe('parseDiffPatch', () => {
    it('counts additions, deletions, context lines, and hunk metadata', () => {
      const patch = [
        'diff --git a/src/app.ts b/src/app.ts',
        'index 123..456 100644',
        '--- a/src/app.ts',
        '+++ b/src/app.ts',
        '@@ -1,3 +1,4 @@',
        ' import { App } from "./app";',
        '-const oldName = "api";',
        '+const newName = "api";',
        '+const enabled = true;',
        ' export { App };',
      ].join('\n');

      expect(parseDiffPatch(patch)).toEqual({
        additions: 2,
        deletions: 1,
        hunks: [
          {
            oldStart: 1,
            oldLines: 3,
            newStart: 1,
            newLines: 4,
            changes: [
              { type: 'context', content: 'import { App } from "./app";' },
              { type: 'delete', content: 'const oldName = "api";' },
              { type: 'add', content: 'const newName = "api";' },
              { type: 'add', content: 'const enabled = true;' },
              { type: 'context', content: 'export { App };' },
            ],
          },
        ],
      });
    });

    it('returns an empty result when no patch is provided', () => {
      expect(parseDiffPatch(undefined)).toEqual({
        additions: 0,
        deletions: 0,
        hunks: [],
      });
    });
  });

  describe('aggregateFileChanges', () => {
    it('aggregates totals and averages churn ratio', () => {
      const fileChanges: FileChangeData[] = [
        { filePath: 'a.ts', additions: 10, deletions: 5, churnRatio: 0.25 },
        { filePath: 'b.ts', additions: 2, deletions: 3, churnRatio: 0.75 },
      ];

      expect(aggregateFileChanges(fileChanges)).toEqual({
        totalAdditions: 12,
        totalDeletions: 8,
        totalFiles: 2,
        averageChurnRatio: 0.5,
      });
    });

    it('returns zero values for an empty file list', () => {
      expect(aggregateFileChanges([])).toEqual({
        totalAdditions: 0,
        totalDeletions: 0,
        totalFiles: 0,
        averageChurnRatio: 0,
      });
    });
  });
});
