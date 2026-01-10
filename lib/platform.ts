/**
 * Platform Detection Utility
 * 
 * Detects the runtime environment to enable conditional feature loading.
 * This allows the application to run on Vercel, Azure App Services, and AWS Elastic Beanstalk
 * while handling platform-specific features gracefully.
 */

/**
 * Check if the application is running on Vercel
 * Vercel sets the VERCEL environment variable to '1' during deployment
 */
export const isVercel = process.env.VERCEL === '1';

/**
 * Check if the application is running on Azure App Services
 * Azure sets WEBSITE_SITE_NAME for all deployed applications
 */
export const isAzure = process.env.WEBSITE_SITE_NAME !== undefined;

/**
 * Check if the application is running on AWS Elastic Beanstalk
 * AWS EB sets AWS_EB_PLATFORM_NAME or AWS_EXECUTION_ENV for deployed applications
 */
export const isAWS = 
  process.env.AWS_EB_PLATFORM_NAME !== undefined ||
  process.env.AWS_EXECUTION_ENV !== undefined ||
  process.env.ELASTIC_BEANSTALK_ENVIRONMENT !== undefined;

/**
 * Check if the application is running in a development environment
 */
export const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Check if the application is running in production
 */
export const isProduction = process.env.NODE_ENV === 'production';

/**
 * Get the current platform name for logging/debugging
 */
export const getPlatformName = (): string => {
  if (isVercel) return 'Vercel';
  if (isAzure) return 'Azure App Services';
  if (isAWS) return 'AWS Elastic Beanstalk';
  if (isDevelopment) return 'Development';
  return 'Unknown';
};

/**
 * Log platform information (useful for debugging)
 */
export const logPlatformInfo = (): void => {
  if (typeof console !== 'undefined') {
    console.log(`[Platform Detection] Running on: ${getPlatformName()}`);
  }
};
