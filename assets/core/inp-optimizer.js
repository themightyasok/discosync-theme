/**
 * Interaction to Next Paint (INP) Optimizer
 * Optimizes JavaScript event handlers for better INP scores
 */

import themeLogger from './logger.js';

class INPOptimizer {
  constructor() {
    this.pendingInteractions = new Map();
    this.deferredTasks = [];
    this.init();
  }

  init() {
    // Use passive event listeners where possible
    this.setupPassiveListeners();
    
    // Optimize scroll handlers
    this.optimizeScrollHandlers();
    
    // Optimize resize handlers
    this.optimizeResizeHandlers();
    
    // Batch DOM updates
    this.setupBatchedUpdates();
  }

  /**
   * Setup passive event listeners for better scroll performance
   */
  setupPassiveListeners() {
    // Override addEventListener to automatically use passive for scroll/touch events
    const originalAddEventListener = EventTarget.prototype.addEventListener;
    
    EventTarget.prototype.addEventListener = function(type, handler, options) {
      if (typeof options === 'boolean') {
        options = { capture: options };
      } else if (!options) {
        options = {};
      }
      
      // Use passive listeners for scroll/touch events if not explicitly disabled
      if ((type === 'touchstart' || type === 'touchmove' || type === 'scroll' || type === 'wheel') && 
          options.passive === undefined && 
          !options.capture) {
        options.passive = true;
      }
      
      return originalAddEventListener.call(this, type, handler, options);
    };
  }

  /**
   * Optimize scroll handlers with requestAnimationFrame
   */
  optimizeScrollHandlers() {
    let ticking = false;
    
    document.addEventListener('scroll', () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          // Process scroll-related updates here
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  /**
   * Optimize resize handlers with debouncing
   */
  optimizeResizeHandlers() {
    let resizeTimeout;
    
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        // Process resize-related updates here
        window.dispatchEvent(new CustomEvent('optimized-resize'));
      }, 150);
    }, { passive: true });
  }

  /**
   * Batch DOM updates using requestIdleCallback or setTimeout
   */
  setupBatchedUpdates() {
    this.batchQueue = [];
    this.batchTimeout = null;
    
    if ('requestIdleCallback' in window) {
      // Use requestIdleCallback for better performance
      this.scheduleBatch = (callback) => {
        this.batchQueue.push(callback);
        
        if (!this.batchTimeout) {
          window.requestIdleCallback(() => {
            this.batchQueue.forEach(cb => cb());
            this.batchQueue = [];
            this.batchTimeout = null;
          }, { timeout: 100 });
          this.batchTimeout = true;
        }
      };
    } else {
      // Fallback to setTimeout
      this.scheduleBatch = (callback) => {
        this.batchQueue.push(callback);
        
        if (!this.batchTimeout) {
          this.batchTimeout = setTimeout(() => {
            this.batchQueue.forEach(cb => cb());
            this.batchQueue = [];
            this.batchTimeout = null;
          }, 0);
        }
      };
    }
  }

  /**
   * Schedule a task for batched execution
   */
  scheduleTask(callback) {
    this.scheduleBatch(callback);
  }

  /**
   * Optimize click handlers - debounce rapid clicks
   */
  optimizeClicks(element, handler, delay = 300) {
    let lastClick = 0;
    let timeout;
    
    element.addEventListener('click', (e) => {
      const now = Date.now();
      const timeSinceLastClick = now - lastClick;
      
      if (timeSinceLastClick < delay) {
        clearTimeout(timeout);
      }
      
      timeout = setTimeout(() => {
        handler(e);
        lastClick = Date.now();
      }, delay);
    });
  }
}

// Initialize and export
const inpOptimizer = new INPOptimizer();
window.inpOptimizer = inpOptimizer;

export default inpOptimizer;

