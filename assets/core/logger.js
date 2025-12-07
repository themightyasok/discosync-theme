/**
 * Theme Logger
 * Centralized logging system with debug mode and production handling
 */

class ThemeLogger {
  constructor() {
    this.isDebug = this.checkDebugMode();
    this.isProduction = !window.Shopify?.designMode && 
                       !document.documentElement.classList.contains('shopify-design-mode');
    this.logs = [];
    this.maxLogs = 100;
  }

  /**
   * Check if debug mode is enabled
   */
  checkDebugMode() {
    // Use CONFIG from window if available (after constants bundle loads)
    // Fallback to hardcoded values
    const DEBUG_PARAM = (window.CONFIG && window.CONFIG.DEBUG_PARAM) || 'debug';
    const DEBUG_STORAGE_KEY = (window.CONFIG && window.CONFIG.DEBUG_STORAGE_KEY) || 'theme-debug';
    
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.has(DEBUG_PARAM) || 
           localStorage.getItem(DEBUG_STORAGE_KEY) === 'true';
  }

  /**
   * Log message (only in debug mode or non-production)
   */
  log(message, ...args) {
    if (this.isDebug || !this.isProduction) {
      console.log(`[Theme] ${message}`, ...args);
      this.addToLogs('log', message, args);
    }
  }

  /**
   * Log error (always shown)
   */
  error(message, ...args) {
    console.error(`[Theme Error] ${message}`, ...args);
    this.addToLogs('error', message, args);
    
    // In production, could send to error tracking service
    if (this.isProduction) {
      this.reportError(message, args);
    }
  }

  /**
   * Log warning (only in debug mode or non-production)
   */
  warn(message, ...args) {
    if (this.isDebug || !this.isProduction) {
      console.warn(`[Theme Warning] ${message}`, ...args);
      this.addToLogs('warn', message, args);
    }
  }

  /**
   * Debug log (only in explicit debug mode)
   */
  debug(message, ...args) {
    if (this.isDebug) {
      console.debug(`[Theme Debug] ${message}`, ...args);
      this.addToLogs('debug', message, args);
    }
  }

  /**
   * Performance log
   */
  perf(label, duration, metadata = {}) {
    if (this.isDebug || window.location.search.includes('perf=1')) {
      console.log(`[Theme Perf] ${label}: ${duration.toFixed(2)}ms`, metadata);
      this.addToLogs('perf', `${label}: ${duration.toFixed(2)}ms`, metadata);
    }
  }

  /**
   * Add log to internal storage
   */
  addToLogs(level, message, args) {
    this.logs.push({
      level,
      message,
      args,
      timestamp: Date.now(),
    });

    // Limit log storage
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }
  }

  /**
   * Report error to tracking service (optional integration)
   */
  reportError(message, args) {
    // Placeholder for error tracking service integration
    // Example: Sentry, LogRocket, etc.
    if (window.themeErrorReporter) {
      window.themeErrorReporter.captureException(new Error(message), {
        extra: args,
      });
    }
  }

  /**
   * Get all logs
   */
  getLogs() {
    return this.logs;
  }

  /**
   * Clear logs
   */
  clearLogs() {
    this.logs = [];
  }

  /**
   * Export logs as JSON
   */
  exportLogs() {
    return JSON.stringify(this.logs, null, 2);
  }
}

// Initialize and export
const themeLogger = new ThemeLogger();
window.themeLogger = themeLogger;

// CONFIG will be available globally after constants.js loads
// Use fallback values for immediate access
const getConfig = () => {
  if (window.CONFIG) return window.CONFIG;
  return {
    DEBUG_PARAM: 'debug',
    DEBUG_STORAGE_KEY: 'theme-debug',
  };
};

export default themeLogger;

