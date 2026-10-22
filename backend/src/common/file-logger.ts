import { ConsoleLogger } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface FileLoggerOptions {
  logDir?: string;
  maxFileSizeBytes?: number;
  maxFiles?: number;
  fileLoggingEnabled?: boolean;
}

export class FileLogger extends ConsoleLogger {
  private logStream: fs.WriteStream | null = null;
  private currentLogDate = '';
  private currentFileIndex = 0;
  private currentFileSize = 0;
  private currentFilePath = '';

  private readonly logDir: string;
  private readonly maxFileSizeBytes: number;
  private readonly maxFiles: number;
  private readonly fileLoggingEnabled: boolean;

  constructor(options?: FileLoggerOptions) {
    super();

    this.logDir = options?.logDir || process.env.LOG_DIR || path.join(process.cwd(), 'log');
    
    const configuredMaxMb = parseInt(process.env.LOG_MAX_FILE_SIZE_MB || '10', 10);
    this.maxFileSizeBytes =
      options?.maxFileSizeBytes ||
      (process.env.LOG_MAX_FILE_SIZE_BYTES ? parseInt(process.env.LOG_MAX_FILE_SIZE_BYTES, 10) : configuredMaxMb * 1024 * 1024);

    this.maxFiles =
      options?.maxFiles ||
      parseInt(process.env.LOG_MAX_FILES || '14', 10);

    this.fileLoggingEnabled =
      options?.fileLoggingEnabled !== undefined
        ? options.fileLoggingEnabled
        : process.env.LOG_FILE_ENABLED !== 'false';
  }

  private resolveLogPath(dateStr: string, index: number): string {
    const filename = index === 0 ? `${dateStr}_log.txt` : `${dateStr}_log.${index}.txt`;
    return path.join(this.logDir, filename);
  }

  private pruneOldLogs() {
    try {
      if (!fs.existsSync(this.logDir)) {
        return;
      }

      const entries = fs.readdirSync(this.logDir);
      const logFiles: Array<{ name: string; fullPath: string; mtimeMs: number }> = [];

      for (const entry of entries) {
        if (entry.includes('_log') && entry.endsWith('.txt')) {
          const fullPath = path.join(this.logDir, entry);
          try {
            const stats = fs.statSync(fullPath);
            if (stats.isFile()) {
              logFiles.push({ name: entry, fullPath, mtimeMs: stats.mtimeMs });
            }
          } catch {
            // Ignore missing/stat errors during concurrent file operations
          }
        }
      }

      // Include currently active log file even if stream write has not flushed to disk yet
      if (this.currentFilePath) {
        const activeBasename = path.basename(this.currentFilePath);
        if (!logFiles.some((f) => f.name === activeBasename)) {
          logFiles.push({
            name: activeBasename,
            fullPath: this.currentFilePath,
            mtimeMs: Date.now(),
          });
        }
      }

      // Sort newest first
      logFiles.sort((a, b) => b.mtimeMs - a.mtimeMs);

      if (logFiles.length > this.maxFiles) {
        const filesToDelete = logFiles.slice(this.maxFiles);
        for (const file of filesToDelete) {
          // Do not delete currently active log file
          if (file.fullPath !== this.currentFilePath && fs.existsSync(file.fullPath)) {
            try {
              fs.unlinkSync(file.fullPath);
            } catch {
              // Ignore unlink failures
            }
          }
        }
      }
    } catch {
      // Fail closed to avoid crashing application logger on filesystem issues
    }
  }

  private rotateStream(dateStr: string) {
    if (this.logStream) {
      try {
        this.logStream.end();
      } catch {
        // Ignore stream close error
      }
      this.logStream = null;
    }

    this.currentFileIndex++;
    this.currentFilePath = this.resolveLogPath(dateStr, this.currentFileIndex);

    if (fs.existsSync(this.currentFilePath)) {
      this.currentFileSize = fs.statSync(this.currentFilePath).size;
    } else {
      this.currentFileSize = 0;
    }

    this.logStream = fs.createWriteStream(this.currentFilePath, { flags: 'a' });
    this.pruneOldLogs();
  }

  private getLogStream(): fs.WriteStream | null {
    if (!this.fileLoggingEnabled) {
      return null;
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    // Date change rollover
    if (this.currentLogDate !== dateStr || !this.logStream) {
      if (this.logStream) {
        try {
          this.logStream.end();
        } catch {
          // Ignore
        }
      }

      this.currentLogDate = dateStr;
      this.currentFileIndex = 0;

      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }

      this.currentFilePath = this.resolveLogPath(dateStr, 0);
      if (fs.existsSync(this.currentFilePath)) {
        this.currentFileSize = fs.statSync(this.currentFilePath).size;
      } else {
        this.currentFileSize = 0;
      }

      this.logStream = fs.createWriteStream(this.currentFilePath, { flags: 'a' });
      this.pruneOldLogs();
    }

    // Size limit rotation rollover
    if (this.currentFileSize >= this.maxFileSizeBytes) {
      this.rotateStream(dateStr);
    }

    return this.logStream;
  }

  private writeToFile(level: string, message: any, context?: string) {
    if (!this.fileLoggingEnabled) {
      return;
    }

    const stream = this.getLogStream();
    if (!stream) {
      return;
    }

    const timestamp = new Date().toISOString();
    const formattedContext = context ? ` [${context}]` : '';

    let cleanMessage = message;
    if (message instanceof Error) {
      cleanMessage = `${message.message}\n${message.stack || ''}`;
    } else if (typeof message === 'object' && message !== null) {
      try {
        cleanMessage = JSON.stringify(message);
      } catch {
        cleanMessage = String(message);
      }
    }

    const logLine = `${timestamp} [${level.toUpperCase()}]${formattedContext} ${cleanMessage}\n`;
    const byteLength = Buffer.byteLength(logLine, 'utf8');

    stream.write(logLine);
    this.currentFileSize += byteLength;
  }

  log(message: any, context?: string) {
    super.log(message, context);
    this.writeToFile('log', message, context);
  }

  error(message: any, stack?: string, context?: string) {
    super.error(message, stack, context);
    const actualContext = context || (typeof stack === 'string' && !stack.includes('\n') ? stack : undefined);
    const actualStack = typeof stack === 'string' && stack.includes('\n') ? stack : undefined;

    this.writeToFile('error', message, actualContext);
    if (actualStack) {
      this.writeToFile('error-stack', actualStack, actualContext);
    }
  }

  warn(message: any, context?: string) {
    super.warn(message, context);
    this.writeToFile('warn', message, context);
  }

  debug(message: any, context?: string) {
    super.debug(message, context);
    this.writeToFile('debug', message, context);
  }

  verbose(message: any, context?: string) {
    super.verbose(message, context);
    this.writeToFile('verbose', message, context);
  }
}
