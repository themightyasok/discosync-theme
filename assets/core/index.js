/**
 * Core Bundle Entry Point
 * This file imports all core utilities and exposes them globally
 * Vite will bundle this into core-bundle.js (IIFE format)
 */

// Import all core modules
import accessibilityEnhancer from './accessibility-enhancer.js';
import clsPrevention from './cls-prevention.js';
import configValidator from './config-validator.js';
import * as constants from './constants.js';
import ErrorBoundary from './error-boundary.js';
import inpOptimizer from './inp-optimizer.js';
import themeLogger from './logger.js';
import perfMonitor from './performance-monitor.js';
import performanceReporter from './performance-reporter.js';
import webVitalsMonitor from './web-vitals.js';

// Re-export for bundling
export {
  constants,
  themeLogger,
  perfMonitor,
  configValidator,
  ErrorBoundary,
  webVitalsMonitor,
  accessibilityEnhancer,
  performanceReporter,
  clsPrevention,
  inpOptimizer,
};

// Expose on window for global access (IIFE will handle this)
if (typeof window !== 'undefined') {
  // Constants are already exposed in constants.js
  // Logger is already exposed in logger.js
  // Performance monitor
  window.perfMonitor = perfMonitor;
  // Config validator
  window.configValidator = configValidator;
  // Error boundary
  window.ErrorBoundary = ErrorBoundary;
  // Web Vitals monitor
  window.webVitalsMonitor = webVitalsMonitor;
  // Accessibility enhancer
  window.accessibilityEnhancer = accessibilityEnhancer;
  // Performance reporter
  window.performanceReporter = performanceReporter;
  // CLS prevention
  window.clsPrevention = clsPrevention;
  // INP optimizer
  window.inpOptimizer = inpOptimizer;
}
