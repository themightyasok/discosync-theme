/**
 * Core Web Vitals Monitoring
 * Tracks LCP, CLS, FID/INP for performance monitoring
 */

import themeLogger from './logger.js';
import perfMonitor from './performance-monitor.js';

class WebVitalsMonitor {
  constructor() {
    this.metrics = {
      lcp: null,
      fid: null,
      cls: null,
      inp: null,
      ttfb: null,
    };
    this.isEnabled =
      window.location.search.includes('perf=1') ||
      localStorage.getItem('theme-perf-monitoring') === 'true';

    if (this.isEnabled && 'PerformanceObserver' in window) {
      this.init();
    }
  }

  init() {
    // Largest Contentful Paint (LCP)
    this.observeLCP();

    // Cumulative Layout Shift (CLS)
    this.observeCLS();

    // First Input Delay (FID) - deprecated, use INP instead
    this.observeFID();

    // Interaction to Next Paint (INP) - modern replacement for FID
    this.observeINP();

    // Time to First Byte (TTFB)
    this.measureTTFB();
  }

  observeLCP() {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];

        this.metrics.lcp = {
          value: lastEntry.renderTime || lastEntry.loadTime,
          element: lastEntry.element?.tagName || 'unknown',
          url: lastEntry.url || 'unknown',
        };

        themeLogger.perf('LCP (Largest Contentful Paint)', this.metrics.lcp.value, {
          element: this.metrics.lcp.element,
        });

        perfMonitor.recordMetric('webVitals', {
          metric: 'LCP',
          value: this.metrics.lcp.value,
          timestamp: Date.now(),
        });
      });

      observer.observe({ entryTypes: ['largest-contentful-paint'] });
    } catch (e) {
      themeLogger.debug('LCP observation not supported:', e);
    }
  }

  observeCLS() {
    try {
      let clsValue = 0;
      const clsEntries = [];

      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          // Only count layout shifts without recent user input
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
            clsEntries.push(entry);
          }
        }

        this.metrics.cls = {
          value: clsValue,
          entries: clsEntries.length,
        };

        if (clsValue > 0.1) {
          themeLogger.warn('CLS (Cumulative Layout Shift) detected:', clsValue);
        }
      });

      observer.observe({ entryTypes: ['layout-shift'] });

      // Report final CLS on page unload
      window.addEventListener('beforeunload', () => {
        perfMonitor.recordMetric('webVitals', {
          metric: 'CLS',
          value: clsValue,
          timestamp: Date.now(),
        });
      });
    } catch (e) {
      themeLogger.debug('CLS observation not supported:', e);
    }
  }

  observeFID() {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.metrics.fid = {
            value: entry.processingStart - entry.startTime,
            eventType: entry.name,
          };

          perfMonitor.recordMetric('webVitals', {
            metric: 'FID',
            value: this.metrics.fid.value,
            timestamp: Date.now(),
          });
        }
      });

      observer.observe({ entryTypes: ['first-input'] });
    } catch (e) {
      themeLogger.debug('FID observation not supported:', e);
    }
  }

  observeINP() {
    try {
      // INP is measured differently - track all interactions
      let interactionCount = 0;
      let maxDelay = 0;
      let worstInteraction = null;

      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'event') {
            interactionCount++;
            const delay = entry.processingStart - entry.startTime;

            if (delay > maxDelay) {
              maxDelay = delay;
              worstInteraction = {
                type: entry.name,
                delay: delay,
                target: entry.target?.tagName || 'unknown',
              };
            }
          }
        }

        // INP is the worst interaction delay
        this.metrics.inp = {
          value: maxDelay,
          worstInteraction: worstInteraction,
          totalInteractions: interactionCount,
        };
      });

      observer.observe({ entryTypes: ['event'] });

      // Report INP on page unload
      window.addEventListener('beforeunload', () => {
        if (maxDelay > 0) {
          perfMonitor.recordMetric('webVitals', {
            metric: 'INP',
            value: maxDelay,
            timestamp: Date.now(),
          });
        }
      });
    } catch (e) {
      themeLogger.debug('INP observation not supported:', e);
    }
  }

  measureTTFB() {
    try {
      const navigation = performance.getEntriesByType('navigation')[0];
      if (navigation) {
        this.metrics.ttfb = {
          value: navigation.responseStart - navigation.requestStart,
          dns: navigation.domainLookupEnd - navigation.domainLookupStart,
          connection: navigation.connectEnd - navigation.connectStart,
        };

        perfMonitor.recordMetric('webVitals', {
          metric: 'TTFB',
          value: this.metrics.ttfb.value,
          timestamp: Date.now(),
        });
      }
    } catch (e) {
      themeLogger.debug('TTFB measurement not supported:', e);
    }
  }

  getReport() {
    return {
      lcp: this.metrics.lcp,
      fid: this.metrics.fid,
      cls: this.metrics.cls,
      inp: this.metrics.inp,
      ttfb: this.metrics.ttfb,
      thresholds: {
        lcp: { good: 2500, needsImprovement: 4000 },
        fid: { good: 100, needsImprovement: 300 },
        cls: { good: 0.1, needsImprovement: 0.25 },
        inp: { good: 200, needsImprovement: 500 },
        ttfb: { good: 800, needsImprovement: 1800 },
      },
    };
  }

  report() {
    if (!this.isEnabled) {
      return;
    }

    const report = this.getReport();
    console.group('📊 Core Web Vitals Report');

    if (report.lcp) {
      const status =
        report.lcp.value <= report.thresholds.lcp.good
          ? '✅'
          : report.lcp.value <= report.thresholds.lcp.needsImprovement
            ? '⚠️'
            : '❌';
      console.log(`${status} LCP: ${report.lcp.value.toFixed(2)}ms (${report.lcp.element})`);
    }

    if (report.cls) {
      const status =
        report.cls.value <= report.thresholds.cls.good
          ? '✅'
          : report.cls.value <= report.thresholds.cls.needsImprovement
            ? '⚠️'
            : '❌';
      console.log(`${status} CLS: ${report.cls.value.toFixed(3)}`);
    }

    if (report.inp) {
      const status =
        report.inp.value <= report.thresholds.inp.good
          ? '✅'
          : report.inp.value <= report.thresholds.inp.needsImprovement
            ? '⚠️'
            : '❌';
      console.log(`${status} INP: ${report.inp.value.toFixed(2)}ms`);
    }

    if (report.ttfb) {
      const status =
        report.ttfb.value <= report.thresholds.ttfb.good
          ? '✅'
          : report.ttfb.value <= report.thresholds.ttfb.needsImprovement
            ? '⚠️'
            : '❌';
      console.log(`${status} TTFB: ${report.ttfb.value.toFixed(2)}ms`);
    }

    console.groupEnd();
  }
}

// Initialize and export
const webVitalsMonitor = new WebVitalsMonitor();
window.webVitalsMonitor = webVitalsMonitor;

// Auto-report on page unload if enabled
window.addEventListener('beforeunload', () => {
  if (webVitalsMonitor.isEnabled) {
    webVitalsMonitor.report();
  }
});

export default webVitalsMonitor;
