/**
 * Structured Logging Module
 * 
 * Provides consistent, structured logging across the application.
 * Supports multiple log levels, contextual information, and sensitive data redaction.
 * 
 * Features:
 * - Multiple log levels (debug, info, warn, error)
 * - Automatic sensitive data redaction
 * - Child loggers with inherited context
 * - Request tracing support
 * - Production-safe logging
 * 
 * @example
 * logger.info('User logged in', { userId: '123', email: 'user@example.com' });
 * logger.error('Database connection failed', { error: 'Connection timeout', retries: 3 });
 * 
 * @module lib/logger
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  [key: string]: unknown;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  stack?: string;
  requestId?: string;
}

/**
 * Sensitive field patterns that should be redacted
 * Matches both exact keys and patterns
 */
const SENSITIVE_PATTERNS = [
  // Authentication & credentials
  /password/i,
  /passwd/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /auth/i,
  /credential/i,
  /bearer/i,
  /jwt/i,
  /session/i,
  /cookie/i,
  
  // Personal information
  /ssn/i,
  /social[_-]?security/i,
  /credit[_-]?card/i,
  /card[_-]?number/i,
  /cvv/i,
  /cvc/i,
  /expir/i,
  /pin/i,
  
  // Contact information
  /phone/i,
  /mobile/i,
  /address/i,
  /street/i,
  /zip[_-]?code/i,
  /postal/i,
  
  // Financial
  /account[_-]?number/i,
  /routing/i,
  /iban/i,
  /swift/i,
  /bank/i,
  
  // Other sensitive data
  /private[_-]?key/i,
  /encryption/i,
  /salt/i,
  /hash/i,
  /signature/i,
];

/**
 * Exact field names to always redact
 */
const SENSITIVE_FIELDS = new Set([
  'password',
  'token',
  'apiKey',
  'api_key',
  'secret',
  'authorization',
  'cookie',
  'sessionId',
  'session_id',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'privateKey',
  'private_key',
  'creditCard',
  'credit_card',
  'cardNumber',
  'card_number',
  'cvv',
  'ssn',
  'socialSecurity',
  'social_security',
]);

/**
 * Redaction placeholder
 */
const REDACTED = '[REDACTED]';

/**
 * Check if a field name is sensitive
 */
function isSensitiveField(fieldName: string): boolean {
  // Check exact matches first (faster)
  if (SENSITIVE_FIELDS.has(fieldName)) {
    return true;
  }
  
  // Check patterns
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(fieldName));
}

/**
 * Recursively redact sensitive data from an object
 * 
 * @param obj - Object to redact
 * @param maxDepth - Maximum recursion depth (prevents infinite loops)
 * @returns Redacted copy of the object
 */
function redactSensitiveData(obj: unknown, maxDepth: number = 10): unknown {
  if (maxDepth <= 0) {
    return '[MAX_DEPTH_EXCEEDED]';
  }
  
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  // Handle primitive types
  if (typeof obj !== 'object') {
    return obj;
  }
  
  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => redactSensitiveData(item, maxDepth - 1));
  }
  
  // Handle Date objects
  if (obj instanceof Date) {
    return obj.toISOString();
  }
  
  // Handle Error objects
  if (obj instanceof Error) {
    return {
      name: obj.name,
      message: obj.message,
      stack: obj.stack,
    };
  }
  
  // Handle regular objects
  const redacted: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (isSensitiveField(key)) {
      redacted[key] = REDACTED;
    } else if (typeof value === 'string' && value.length > 1000) {
      // Truncate very long strings
      redacted[key] = value.substring(0, 1000) + '... [TRUNCATED]';
    } else {
      redacted[key] = redactSensitiveData(value, maxDepth - 1);
    }
  }
  
  return redacted;
}

/**
 * Redact sensitive information from a string
 * 
 * @param str - String to redact
 * @returns Redacted string
 */
function redactString(str: string): string {
  // Redact JWT tokens
  str = str.replace(/eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g, '[JWT_REDACTED]');
  
  // Redact Bearer tokens
  str = str.replace(/Bearer\s+[a-zA-Z0-9_-]+/gi, 'Bearer [REDACTED]');
  
  // Redact API keys (common patterns)
  str = str.replace(/[a-zA-Z0-9]{32,}/g, (match) => {
    // Only redact if it looks like a key/token (mix of chars)
    if (/[a-z]/.test(match) && /[A-Z0-9]/.test(match)) {
      return '[KEY_REDACTED]';
    }
    return match;
  });
  
  // Redact email addresses (partially)
  str = str.replace(/([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, (match, local, domain) => {
    const maskedLocal = local.length > 2 
      ? local[0] + '*'.repeat(local.length - 2) + local[local.length - 1]
      : '*'.repeat(local.length);
    return `${maskedLocal}@${domain}`;
  });
  
  // Redact credit card numbers
  str = str.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, '[CARD_REDACTED]');
  
  // Redact SSN
  str = str.replace(/\b\d{3}[\s-]?\d{2}[\s-]?\d{4}\b/g, '[SSN_REDACTED]');
  
  return str;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private logLevel: LogLevel = this.isDevelopment ? 'debug' : 'info';
  private enableRedaction = true;

  /**
   * Set the minimum log level
   */
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  /**
   * Enable or disable sensitive data redaction
   * WARNING: Disabling redaction may expose sensitive data in logs
   */
  setRedaction(enabled: boolean): void {
    this.enableRedaction = enabled;
  }

  /**
   * Check if a log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    return levels.indexOf(level) >= levels.indexOf(this.logLevel);
  }

  /**
   * Safely redact context if redaction is enabled
   */
  private safeRedact(context?: LogContext): LogContext | undefined {
    if (!context || !this.enableRedaction) {
      return context;
    }
    return redactSensitiveData(context) as LogContext;
  }

  /**
   * Format log entry for output
   */
  private formatEntry(entry: LogEntry): string {
    const { timestamp, level, message, context, requestId } = entry;
    const levelUpper = level.toUpperCase().padEnd(5);
    const reqIdStr = requestId ? ` [${requestId}]` : '';
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    return `[${timestamp}] ${levelUpper}${reqIdStr} ${message}${contextStr}`;
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
      message: this.enableRedaction ? redactString(message) : message,
      context: this.safeRedact(context),
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
      message: this.enableRedaction ? redactString(message) : message,
      context: this.safeRedact(context),
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
      message: this.enableRedaction ? redactString(message) : message,
      context: this.safeRedact(context),
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
      message: this.enableRedaction ? redactString(message) : message,
      context: this.safeRedact(errorContext),
      stack,
    });
  }

  /**
   * Create a child logger with additional context
   */
  child(context: LogContext): ChildLogger {
    return new ChildLogger(this, this.safeRedact(context) || {});
  }

  /**
   * Create a request-scoped logger with request ID
   */
  withRequestId(requestId: string): RequestLogger {
    return new RequestLogger(this, requestId);
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

/**
 * Request-scoped logger that includes request ID in all logs
 */
class RequestLogger {
  constructor(
    private parent: Logger,
    private requestId: string
  ) {}

  debug(message: string, context?: LogContext): void {
    this.parent.debug(message, { ...context, requestId: this.requestId });
  }

  info(message: string, context?: LogContext): void {
    this.parent.info(message, { ...context, requestId: this.requestId });
  }

  warn(message: string, context?: LogContext): void {
    this.parent.warn(message, { ...context, requestId: this.requestId });
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    this.parent.error(message, error, { ...context, requestId: this.requestId });
  }
}

// Export singleton instance
export const logger = new Logger();

// Export types for external use
export type { Logger, ChildLogger, RequestLogger };

// Export utility functions for external use
export { redactSensitiveData, redactString, isSensitiveField };
