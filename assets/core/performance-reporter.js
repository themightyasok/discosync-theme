/**
 * Performance Reporter (RUM - Real User Monitoring)
 * Reports performance metrics to analytics endpoint (if configured)
 */

import perfMonitor from './performance-monitor.js';
import webVitalsMonitor from './web-vitals.js';
import themeLogger from './logger.js';

class PerformanceReporter {
  constructor() {
    this.endpoint = null;
    this.isEnabled = this.checkIfEnabled();
    this.sessionId = this.generateSessionId();
    this.pageLoadTime = Date.now();
    
    if (this.isEnabled) {
      this.init();
    }
  }

  checkIfEnabled() {
    // Check for analytics endpoint in meta tags or settings
    const analyticsEndpoint = document.querySelector('meta[name="analytics-endpoint"]')?.content;
    if (analyticsEndpoint) {
      this.endpoint = analyticsEndpoint;
      return true;
    }
    
    // Enable in debug mode
    return window.location.search.includes('perf=1') || 
           localStorage.getItem('theme-perf-reporting') === 'true';
  }

  generateSessionId() {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  init() {
    // Report on page unload
    window.addEventListener('beforeunload', () => {
      this.report();
    });

    // Report periodically (every 30 seconds)
    if (this.endpoint) {
      setInterval(() => {
        this.report(true); // Periodic report
      }, 30000);
    }
  }

  /**
   * Collect all performance data
   */
  collectMetrics() {
    const perfData = performance.getEntriesByType('navigation')[0];
    const paintMetrics = performance.getEntriesByType('paint');
    const resourceMetrics = performance.getEntriesByType('resource');
    
    const webVitals = webVitalsMonitor.getReport();
    const perfReport = perfMonitor.getReport();

    return {
      sessionId: this.sessionId,
      timestamp: Date.now(),
      pageLoadTime: this.pageLoadTime,
      url: window.location.href,
      userAgent: navigator.userAgent,
      connection: this.getConnectionInfo(),
      
      // Navigation Timing
      navigation: perfData ? {
        domContentLoaded: perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart,
        loadComplete: perfData.loadEventEnd - perfData.loadEventStart,
        domInteractive: perfData.domInteractive - perfData.domContentLoadedEventStart,
        totalTime: perfData.loadEventEnd - perfData.fetchStart,
      } : null,
      
      // Paint Timing
      paint: {
        firstPaint: paintMetrics.find(m => m.name === 'first-paint')?.startTime || null,
        firstContentfulPaint: paintMetrics.find(m => m.name === 'first-contentful-paint')?.startTime || null,
      },
      
      // Web Vitals
      webVitals: {
        lcp: webVitals.lcp,
        cls: webVitals.cls,
        inp: webVitals.inp,
        ttfb: webVitals.ttfb,
      },
      
      // Custom Metrics
      custom: perfReport,
      
      // Resource Metrics
      resources: this.summarizeResources(resourceMetrics),
    };
  }

  /**
   * Get connection information
   */
  getConnectionInfo() {
    if ('connection' in navigator) {
      const conn = navigator.connection;
      return {
        effectiveType: conn.effectiveType,
        downlink: conn.downlink,
        rtt: conn.rtt,
        saveData: conn.saveData,
      };
    }
    return null;
  }

  /**
   * Summarize resource loading
   */
  summarizeResources(resources) {
    const summary = {
      total: resources.length,
      totalSize: 0,
      byType: {},
      slowest: [],
    };

    resources.forEach(resource => {
      summary.totalSize += resource.transferSize || 0;
      
      const type = resource.initiatorType || 'other';
      if (!summary.byType[type]) {
        summary.byType[type] = { count: 0, totalSize: 0, totalTime: 0 };
      }
      summary.byType[type].count++;
      summary.byType[type].totalSize += resource.transferSize || 0;
      summary.byType[type].totalTime += resource.duration || 0;
      
      // Track slowest resources
      if (resource.duration > 1000) {
        summary.slowest.push({
          name: resource.name,
          duration: resource.duration,
          size: resource.transferSize,
          type: type,
        });
      }
    });

    // Sort slowest resources
    summary.slowest.sort((a, b) => b.duration - a.duration);
    summary.slowest = summary.slowest.slice(0, 10);

    return summary;
  }

  /**
   * Report metrics
   */
  async report(isPeriodic = false) {
    if (!this.isEnabled) return;

    try {
      const metrics = this.collectMetrics();
      
      if (this.endpoint) {
        // Send to analytics endpoint
        await fetch(this.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...metrics,
            isPeriodic,
          }),
          keepalive: true, // Ensure request completes even if page unloads
        });
      } else {
        // Log to console in debug mode
        if (themeLogger.isDebug || !isPeriodic) {
          themeLogger.debug('Performance Report:', metrics);
        }
        
        // Store in localStorage for later retrieval
        const reports = JSON.parse(localStorage.getItem('theme-perf-reports') || '[]');
        reports.push(metrics);
        
        // Keep only last 10 reports
        if (reports.length > 10) {
          reports.shift();
        }
        
        localStorage.setItem('theme-perf-reports', JSON.stringify(reports));
      }
    } catch (error) {
      themeLogger.error('Failed to report performance metrics:', error);
    }
  }

  /**
   * Get stored reports
   */
  getStoredReports() {
    return JSON.parse(localStorage.getItem('theme-perf-reports') || '[]');
  }

  /**
   * Clear stored reports
   */
  clearStoredReports() {
    localStorage.removeItem('theme-perf-reports');
  }
}

// Initialize and export
const performanceReporter = new PerformanceReporter();
window.performanceReporter = performanceReporter;

export default performanceReporter;

