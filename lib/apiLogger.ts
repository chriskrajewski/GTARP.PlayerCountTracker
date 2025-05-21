// Define log types 
export type LogLevel = 'info' | 'warn' | 'error';
export type ApiLogEntry = {
  timestamp: string;
  ip: string;
  endpoint: string;
  query?: string;
  responseStatus: number;
  level: LogLevel;
  message: string;
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
    const prefix = `[GROK API] ${logEntry.level.toUpperCase()}:`;
    switch (logEntry.level) {
      case 'error':
        console.error(prefix, logEntry.message, {
          ip: logEntry.ip,
          endpoint: logEntry.endpoint,
          query: logEntry.query,
          status: logEntry.responseStatus
        });
        break;
      case 'warn':
        console.warn(prefix, logEntry.message, {
          ip: logEntry.ip,
          endpoint: logEntry.endpoint,
          query: logEntry.query,
          status: logEntry.responseStatus
        });
        break;
      default:
        console.log(prefix, logEntry.message, {
          ip: logEntry.ip,
          endpoint: logEntry.endpoint,
          query: logEntry.query,
          status: logEntry.responseStatus
        });
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