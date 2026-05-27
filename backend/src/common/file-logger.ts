import { ConsoleLogger } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';

export class FileLogger extends ConsoleLogger {
  private logStream: fs.WriteStream | null = null;
  private currentLogDate = '';

  constructor() {
    super();
  }

  private getLogStream(): fs.WriteStream {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    if (this.currentLogDate !== dateStr || !this.logStream) {
      if (this.logStream) {
        this.logStream.end();
      }
      this.currentLogDate = dateStr;
      const logDir = path.join(process.cwd(), 'log');
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      const logPath = path.join(logDir, `${dateStr}_log.txt`);
      this.logStream = fs.createWriteStream(logPath, { flags: 'a' });
    }
    return this.logStream;
  }

  private writeToFile(level: string, message: any, context?: string) {
    const timestamp = new Date().toISOString();
    const formattedContext = context ? ` [${context}]` : '';
    
    let cleanMessage = message;
    if (message instanceof Error) {
      cleanMessage = `${message.message}\n${message.stack || ''}`;
    } else if (typeof message === 'object' && message !== null) {
      try {
        cleanMessage = JSON.stringify(message);
      } catch (err) {
        cleanMessage = String(message);
      }
    }
    
    const logLine = `${timestamp} [${level.toUpperCase()}]${formattedContext} ${cleanMessage}\n`;
    this.getLogStream().write(logLine);
  }

  log(message: any, context?: string) {
    super.log(message, context);
    this.writeToFile('log', message, context);
  }

  error(message: any, stack?: string, context?: string) {
    super.error(message, stack, context);
    // Handle overload error(message, context) where stack is omitted
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
