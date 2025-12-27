/**
 * Structured Logging Module
 * 
 * Provides consistent, structured logging across the application.
 * Supports multiple log levels and contextual information.
 * 
 * @example
 * logger.info('User logged in', { userId: '123', email: 'user@example.com' });
 * logger.error('Database connection failed', { error: 'Connection timeout', retries: 3 });
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  [key: string]: any;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  stack?: string;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private logLevel: LogLevel = this.isDevelopment ? 'debug' : 'info';

  /**
   * Set the minimum log level
   */
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  /**
   * Check if a log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.logLevel);
  }

  /**
   * Format log entry for output
   */
  private formatEntry(entry: LogEntry): string {
    const { timestamp, level, message, context } = entry;
    const levelUpper = level.toUpperCase().padEnd(5);
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    return `[${timestamp}] ${levelUpper} ${message}${contextStr}`;
  }

  /**
   * Output log entry to console
   */
  private output(entry: LogEntry): void {
    const formatted = this.formatEntry(entry);

    switch (entry.level) {
      case 'error':
        console.error(formatted);
        if (entry.stack) {
          console.error(entry.stack);
        }
        break;
      case 'warn':
        console.warn(formatted);
        break;
      case 'info':
        console.info(formatted);
        break;
      case 'debug':
        console.debug(formatted);
        break;
    }
  }

  /**
   * Log a debug message
   */
  debug(message: string, context?: LogContext): void {
    if (!this.shouldLog('debug')) return;

    this.output({
      timestamp: new Date().toISOString(),
      level: 'debug',
      message,
      context,
    });
  }

  /**
   * Log an info message
   */
  info(message: string, context?: LogContext): void {
    if (!this.shouldLog('info')) return;

    this.output({
      timestamp: new Date().toISOString(),
      level: 'info',
      message,
      context,
    });
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: LogContext): void {
    if (!this.shouldLog('warn')) return;

    this.output({
      timestamp: new Date().toISOString(),
      level: 'warn',
      message,
      context,
    });
  }

  /**
   * Log an error message
   */
  error(message: string, error?: Error | unknown, context?: LogContext): void {
    if (!this.shouldLog('error')) return;

    let stack: string | undefined;
    let errorContext = context || {};

    if (error instanceof Error) {
      stack = error.stack;
      errorContext = {
        ...errorContext,
        errorName: error.name,
        errorMessage: error.message,
      };
    } else if (error) {
      errorContext = {
        ...errorContext,
        error: String(error),
      };
    }

    this.output({
      timestamp: new Date().toISOString(),
      level: 'error',
      message,
      context: errorContext,
      stack,
    });
  }

  /**
   * Create a child logger with additional context
   */
  child(context: LogContext): ChildLogger {
    return new ChildLogger(this, context);
  }
}

/**
 * Child logger that includes parent context
 */
class ChildLogger {
  constructor(
    private parent: Logger,
    private parentContext: LogContext
  ) {}

  private mergeContext(context?: LogContext): LogContext {
    return { ...this.parentContext, ...context };
  }

  debug(message: string, context?: LogContext): void {
    this.parent.debug(message, this.mergeContext(context));
  }

  info(message: string, context?: LogContext): void {
    this.parent.info(message, this.mergeContext(context));
  }

  warn(message: string, context?: LogContext): void {
    this.parent.warn(message, this.mergeContext(context));
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    this.parent.error(message, error, this.mergeContext(context));
  }

  child(context: LogContext): ChildLogger {
    return new ChildLogger(this.parent, this.mergeContext(context));
  }
}

// Export singleton instance
export const logger = new Logger();

// Export types for external use
export type { Logger, ChildLogger };
