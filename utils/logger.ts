/**
 * Logger utility for conditional logging based on environment
 * Prevents console.log statements in production while allowing them in development
 */

const isDev = import.meta.env.DEV;

export const logger = {
  /**
   * Log general information (only in development)
   */
  log: (...args: any[]) => {
    if (isDev) console.log(...args);
  },

  /**
   * Log warnings (only in development)
   */
  warn: (...args: any[]) => {
    if (isDev) console.warn(...args);
  },

  /**
   * Log errors (always logged, even in production)
   */
  error: (...args: any[]) => {
    console.error(...args);
  },

  /**
   * Log debug information (only in development)
   */
  debug: (...args: any[]) => {
    if (isDev) console.debug(...args);
  },

  /**
   * Log informational messages (only in development)
   */
  info: (...args: any[]) => {
    if (isDev) console.info(...args);
  },
};
