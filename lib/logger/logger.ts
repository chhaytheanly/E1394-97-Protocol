import * as fs from 'fs';
import * as path from 'path';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

export interface LogContext {
  userId?: string;
  reportId?: string;
  sampleId?: string;
  testCode?: string;
  action?: string;
  [key: string]: any;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  duration?: number; // milliseconds
}

export class Logger {
  private logDir: string;
  private logLevel: LogLevel;
  private levels = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, FATAL: 4 };

  constructor(logDir: string = './logs', minLogLevel: LogLevel = 'INFO') {
    this.logDir = logDir;
    this.logLevel = minLogLevel;
    
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  private getLogFileName(level: LogLevel): string {
    const date = new Date().toISOString().split('T')[0];
    return path.join(this.logDir, `${level.toLowerCase()}-${date}.log`);
  }

  private shouldLog(level: LogLevel): boolean {
    return this.levels[level] >= this.levels[this.logLevel];
  }

  private formatEntry(entry: LogEntry): string {
    return JSON.stringify(entry);
  }

  private writeToFile(filePath: string, entry: LogEntry): void {
    try {
      const line = this.formatEntry(entry) + '\n';
      fs.appendFileSync(filePath, line);
    } catch (err) {
      console.error(`Failed to write log to ${filePath}:`, err);
    }
  }

  private createEntry(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error,
    duration?: number
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
      duration,
    };
  }

  debug(message: string, context?: LogContext, duration?: number): void {
    if (!this.shouldLog('DEBUG')) return;
    const entry = this.createEntry('DEBUG', message, context, undefined, duration);
    this.writeToFile(this.getLogFileName('DEBUG'), entry);
    console.log(`[DEBUG] ${message}`, context);
  }

  info(message: string, context?: LogContext, duration?: number): void {
    if (!this.shouldLog('INFO')) return;
    const entry = this.createEntry('INFO', message, context, undefined, duration);
    this.writeToFile(this.getLogFileName('INFO'), entry);
    console.log(`[INFO] ${message}`, context);
  }

  warn(message: string, context?: LogContext, error?: Error): void {
    if (!this.shouldLog('WARN')) return;
    const entry = this.createEntry('WARN', message, context, error);
    this.writeToFile(this.getLogFileName('WARN'), entry);
    console.warn(`[WARN] ${message}`, context, error);
  }

  error(message: string, error: Error, context?: LogContext): void {
    if (!this.shouldLog('ERROR')) return;
    const entry = this.createEntry('ERROR', message, context, error);
    this.writeToFile(this.getLogFileName('ERROR'), entry);
    console.error(`[ERROR] ${message}`, error, context);
  }

  fatal(message: string, error: Error, context?: LogContext): void {
    if (!this.shouldLog('FATAL')) return;
    const entry = this.createEntry('FATAL', message, context, error);
    this.writeToFile(this.getLogFileName('FATAL'), entry);
    console.error(`[FATAL] ${message}`, error, context);
  }

  auditLog(
    action: string,
    status: 'SUCCESS' | 'FAILED',
    userId?: string,
    context?: LogContext,
    error?: Error
  ): void {
    const auditEntry: any = {
      timestamp: new Date().toISOString(),
      action,
      status,
      userId,
      ...context,
    };

    if (error) {
      auditEntry.error = {
        name: error.name,
        message: error.message,
      };
    }

    const filePath = path.join(this.logDir, `audit-${new Date().toISOString().split('T')[0]}.log`);
    
    try {
      const line = JSON.stringify(auditEntry) + '\n';
      fs.appendFileSync(filePath, line);
    } catch (err) {
      this.error('Failed to write audit log', err as Error, { action, status });
    }
  }

  logPerformance(operation: string, durationMs: number, context?: LogContext): void {
    const level: LogLevel = durationMs > 5000 ? 'WARN' : 'INFO';
    const message = `Operation [${operation}] completed in ${durationMs}ms`;
    
    if (!this.shouldLog(level)) return;

    const entry = this.createEntry(level, message, context, undefined, durationMs);
    this.writeToFile(this.getLogFileName(level), entry);
  }

  getLogStats(level: LogLevel): { count: number; unique: number } {
    try {
      const filePath = this.getLogFileName(level);
      if (!fs.existsSync(filePath)) {
        return { count: 0, unique: 0 };
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());
      const uniqueMessages = new Set(
        lines.map(l => {
          try {
            return JSON.parse(l).message;
          } catch {
            return l;
          }
        })
      );

      return { count: lines.length, unique: uniqueMessages.size };
    } catch (err) {
      this.error('Failed to get log stats', err as Error, { level });
      return { count: 0, unique: 0 };
    }
  }
}

export const logger = new Logger(
  process.env.LOG_DIR || './logs',
  (process.env.LOG_LEVEL as LogLevel) || 'INFO'
);
