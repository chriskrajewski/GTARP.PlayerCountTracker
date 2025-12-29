// Define log types 
export type LogLevel = 'info' | 'warn' | 'error';
export type ApiLogEntry = {
  timestamp: string;
  endpoint: string;
  method?: string;
  statusCode?: number;
  responseTime?: number;
  requestId?: string;
  level: LogLevel;
  message: string;
  metadata?: Record<string, any>;
};

// Logger function compatible with Edge runtime
export async function logApiRequest(entry: Omit<ApiLogEntry, 'timestamp'>) {
  try {
    const timestamp = new Date().toISOString();
    const logEntry: ApiLogEntry = {
      timestamp,
      ...entry
    };
    
    // Log to console
    const level = logEntry.level || 'info';
    const prefix = `[GROK API] ${level.toUpperCase()}:`;
    const logData = {
      endpoint: logEntry.endpoint,
      method: logEntry.method,
      statusCode: logEntry.statusCode,
      responseTime: logEntry.responseTime,
      requestId: logEntry.requestId,
      ...(logEntry.metadata && { metadata: logEntry.metadata })
    };
    
    switch (level) {
      case 'error':
        console.error(prefix, logEntry.message, logData);
        break;
      case 'warn':
        console.warn(prefix, logEntry.message, logData);
        break;
      default:
        console.log(prefix, logEntry.message, logData);
    }
    
    // In a production environment, you could send logs to an external service
    // like Datadog, Sentry, or a custom endpoint that stores logs
  } catch (error) {
    console.error('Failed to log API request:', error);
  }
}

// Query sanitizer - remove sensitive information
export function sanitizeQuery(query: string): string {
  // List of sensitive keywords to detect
  const sensitiveKeywords = [
    'password', 'token', 'api key', 'secret', 'credential', 'auth', 
    'account', 'ssn', 'social security', 'credit card', 'address', 'phone'
  ];
  
  // Check if query contains sensitive information
  const containsSensitiveInfo = sensitiveKeywords.some(keyword => 
    query.toLowerCase().includes(keyword)
  );
  
  if (containsSensitiveInfo) {
    return '[REDACTED - POTENTIALLY SENSITIVE QUERY]';
  }
  
  return query;
}

// Logger object for convenience
export const apiLogger = {
  info: (message: string, metadata?: Record<string, any>) => {
    console.log(`[API] INFO: ${message}`, metadata || '');
  },
  error: (message: string, metadata?: Record<string, any>) => {
    console.error(`[API] ERROR: ${message}`, metadata || '');
  },
  warn: (message: string, metadata?: Record<string, any>) => {
    console.warn(`[API] WARN: ${message}`, metadata || '');
  },
  debug: (message: string, metadata?: Record<string, any>) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[API] DEBUG: ${message}`, metadata || '');
    }
  }
};