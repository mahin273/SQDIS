import { DebtMarker } from '@prisma/client';
import { DebtScannerService } from './debt-scanner.service';

describe('DebtScannerService', () => {
  let service: DebtScannerService;

  beforeEach(() => {
    service = new DebtScannerService();
  });

  it('detects supported file extensions', () => {
    expect(service.isFileSupported('src/app.ts')).toBe(true);
    expect(service.isFileSupported('scripts/deploy.py')).toBe(true);
    expect(service.isFileSupported('README.md')).toBe(false);
  });

  it('scans single-line comments for debt markers', () => {
    const content = [
      'export function run() {',
      '  // TODO: refactor error handling',
      '  return true;',
      '}',
    ].join('\n');

    expect(service.scanFileContent('src/app.ts', content)).toEqual([
      {
        markerType: DebtMarker.TODO,
        content: 'refactor error handling',
        filePath: 'src/app.ts',
        lineNumber: 2,
      },
    ]);
  });

  it('ignores debt-like text outside comments', () => {
    const content = 'const label = "TODO: not a comment";';

    expect(service.scanFileContent('src/app.ts', content)).toEqual([]);
  });

  it('scans added diff lines for new debt markers', () => {
    const patch = [
      '@@ -1,2 +1,3 @@',
      ' export function run() {',
      '+  // FIXME: handle null input',
      '   return true;',
    ].join('\n');

    expect(service.scanDiffPatch('src/app.ts', patch)).toEqual([
      {
        markerType: DebtMarker.FIXME,
        content: 'handle null input',
        filePath: 'src/app.ts',
        lineNumber: 2,
      },
    ]);
  });

  it('scans removed diff lines for resolved debt markers', () => {
    const patch = [
      '@@ -1,3 +1,2 @@',
      ' export function run() {',
      '-  // HACK: temporary workaround',
      '   return true;',
    ].join('\n');

    expect(service.scanDiffPatchForRemovals('src/app.ts', patch)).toEqual([
      {
        markerType: DebtMarker.HACK,
        content: 'temporary workaround',
        filePath: 'src/app.ts',
        lineNumber: 2,
      },
    ]);
  });
});
