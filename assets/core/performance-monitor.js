/**
 * Performance Monitor
 * Tracks performance metrics for API calls, rendering, and user interactions
 */

import themeLogger from './logger.js';

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      apiCalls: [],
      renderTimes: [],
      errors: [],
      interactions: [],
    };
    this.isEnabled = window.location.search.includes('perf=1') || 
                     localStorage.getItem('theme-perf-monitoring') === 'true';
  }

  /**
   * Measure async operation
   */
  async measureAsync(name, asyncFn, metadata = {}) {
    if (!this.isEnabled) {
      return asyncFn();
    }

    const start = performance.now();
    try {
      const result = await asyncFn();
      const duration = performance.now() - start;
      
      this.recordMetric('apiCalls', {
        name,
        duration,
        success: true,
        timestamp: Date.now(),
        ...metadata,
      });

      if (duration > 1000) {
        themeLogger.warn(`Slow operation: ${name} took ${duration.toFixed(2)}ms`, metadata);
      }

      return result;
    } catch (error) {
      const duration = performance.now() - start;
      
      this.recordMetric('apiCalls', {
        name,
        duration,
        success: false,
        error: error.message,
        timestamp: Date.now(),
        ...metadata,
      });

      this.recordError(error, { operation: name, ...metadata });
      throw error;
    }
  }

  /**
   * Measure render operation
   */
  measureRender(component, itemCount, duration) {
    if (!this.isEnabled) return;

    this.recordMetric('renderTimes', {
      component,
      itemCount,
      duration,
      itemsPerSecond: itemCount / (duration / 1000),
      timestamp: Date.now(),
    });

    themeLogger.perf(`${component} render`, duration, { itemCount });
  }

  /**
   * Record user interaction
   */
  recordInteraction(type, target, metadata = {}) {
    if (!this.isEnabled) return;

    this.recordMetric('interactions', {
      type,
      target,
      timestamp: Date.now(),
      ...metadata,
    });
  }

  /**
   * Record error
   */
  recordError(error, metadata = {}) {
    this.metrics.errors.push({
      message: error.message,
      stack: error.stack,
      timestamp: Date.now(),
      ...metadata,
    });

    // Keep only last 50 errors
    if (this.metrics.errors.length > 50) {
      this.metrics.errors.shift();
    }
  }

  /**
   * Record metric in category
   */
  recordMetric(category, metric) {
    if (!this.metrics[category]) {
      this.metrics[category] = [];
    }

    this.metrics[category].push(metric);

    // Keep only last 100 metrics per category
    if (this.metrics[category].length > 100) {
      this.metrics[category].shift();
    }
  }

  /**
   * Get performance report
   */
  getReport() {
    const apiCalls = this.metrics.apiCalls;
    const renderTimes = this.metrics.renderTimes;

    return {
      summary: {
        totalApiCalls: apiCalls.length,
        totalRenderOperations: renderTimes.length,
        totalErrors: this.metrics.errors.length,
        totalInteractions: this.metrics.interactions.length,
      },
      apiPerformance: {
        total: apiCalls.reduce((sum, m) => sum + m.duration, 0),
        average: apiCalls.length > 0 
          ? apiCalls.reduce((sum, m) => sum + m.duration, 0) / apiCalls.length 
          : 0,
        slowest: apiCalls.length > 0
          ? apiCalls.reduce((max, m) => m.duration > max.duration ? m : max, apiCalls[0])
          : null,
        failed: apiCalls.filter(m => !m.success).length,
      },
      renderPerformance: {
        total: renderTimes.reduce((sum, m) => sum + m.duration, 0),
        average: renderTimes.length > 0
          ? renderTimes.reduce((sum, m) => sum + m.duration, 0) / renderTimes.length
          : 0,
        averageItemsPerSecond: renderTimes.length > 0
          ? renderTimes.reduce((sum, m) => sum + m.itemsPerSecond, 0) / renderTimes.length
          : 0,
      },
      recentErrors: this.metrics.errors.slice(-10),
    };
  }

  /**
   * Display report in console
   */
  report() {
    if (!this.isEnabled) {
      themeLogger.warn('Performance monitoring not enabled. Add ?perf=1 to URL.');
      return;
    }

    const report = this.getReport();
    console.group('🎯 Theme Performance Report');
    console.table(report.summary);
    console.group('📊 API Performance');
    console.table(report.apiPerformance);
    console.groupEnd();
    console.group('🎨 Render Performance');
    console.table(report.renderPerformance);
    console.groupEnd();
    if (report.recentErrors.length > 0) {
      console.group('❌ Recent Errors');
      console.table(report.recentErrors);
      console.groupEnd();
    }
    console.groupEnd();
  }

  /**
   * Clear all metrics
   */
  clear() {
    this.metrics = {
      apiCalls: [],
      renderTimes: [],
      errors: [],
      interactions: [],
    };
  }
}

// Initialize and export
const perfMonitor = new PerformanceMonitor();
window.perfMonitor = perfMonitor;

// Auto-report on page unload if enabled
window.addEventListener('beforeunload', () => {
  if (perfMonitor.isEnabled && perfMonitor.metrics.apiCalls.length > 0) {
    // Could send to analytics endpoint
    localStorage.setItem('theme-last-perf-report', JSON.stringify(perfMonitor.getReport()));
  }
});

export default perfMonitor;

