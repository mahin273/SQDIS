import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { FileLogger } from './file-logger';

describe('FileLogger', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sqdis-log-test-'));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  it('writes log messages to the date-stamped file', async () => {
    const logger = new FileLogger({
      logDir: tempDir,
      fileLoggingEnabled: true,
    });

    logger.log('Test info message', 'TestContext');
    logger.warn('Test warning message', 'TestContext');

    await new Promise((resolve) => setTimeout(resolve, 50));

    const files = fs.readdirSync(tempDir);
    expect(files.length).toBe(1);
    expect(files[0]).toMatch(/_log\.txt$/);

    const content = fs.readFileSync(path.join(tempDir, files[0]), 'utf-8');
    expect(content).toContain('[LOG] [TestContext] Test info message');
    expect(content).toContain('[WARN] [TestContext] Test warning message');
  });

  it('rotates to a numbered segment when size exceeds maxFileSizeBytes', async () => {
    const logger = new FileLogger({
      logDir: tempDir,
      maxFileSizeBytes: 120, // Very small size to force immediate rotation
      fileLoggingEnabled: true,
    });

    // Write enough data to trigger rotation
    logger.log('A'.repeat(80), 'Ctx');
    logger.log('B'.repeat(80), 'Ctx');
    logger.log('C'.repeat(80), 'Ctx');

    await new Promise((resolve) => setTimeout(resolve, 100));

    const files = fs.readdirSync(tempDir);
    expect(files.length).toBeGreaterThanOrEqual(2);

    const hasBaseLog = files.some((f) => f.endsWith('_log.txt'));
    const hasRotatedLog = files.some((f) => f.includes('_log.') && f.endsWith('.txt'));

    expect(hasBaseLog).toBe(true);
    expect(hasRotatedLog).toBe(true);
  });

  it('prunes older log files when file count exceeds maxFiles', async () => {
    // Create 5 dummy historical log files
    for (let i = 1; i <= 5; i++) {
      const filePath = path.join(tempDir, `2026-01-0${i}_log.txt`);
      fs.writeFileSync(filePath, `Historical log ${i}`);
      const pastTime = new Date(2026, 0, i).getTime() / 1000;
      fs.utimesSync(filePath, pastTime, pastTime);
    }

    expect(fs.readdirSync(tempDir).length).toBe(5);

    // Initialize logger with maxFiles = 3
    const logger = new FileLogger({
      logDir: tempDir,
      maxFiles: 3,
      fileLoggingEnabled: true,
    });

    logger.log('Fresh entry triggering prune', 'PruneTest');

    await new Promise((resolve) => setTimeout(resolve, 50));

    const remainingFiles = fs.readdirSync(tempDir);
    expect(remainingFiles.length).toBeLessThanOrEqual(3);
  });

  it('does not write to disk when fileLoggingEnabled is false', async () => {
    const logger = new FileLogger({
      logDir: tempDir,
      fileLoggingEnabled: false,
    });

    logger.log('Memory only message', 'NoDisk');

    await new Promise((resolve) => setTimeout(resolve, 50));

    const files = fs.readdirSync(tempDir);
    expect(files.length).toBe(0);
  });
});
