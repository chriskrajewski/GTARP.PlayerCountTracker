/**
 * Platform Detection Utility
 * 
 * Detects the runtime environment to enable conditional feature loading.
 * This allows the application to run on both Vercel and Azure App Services
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
