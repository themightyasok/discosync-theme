/**
 * Accessibility Enhancer
 * Provides ARIA live regions, focus management, and keyboard navigation improvements
 */

import themeLogger from './logger.js';

class AccessibilityEnhancer {
  constructor() {
    this.liveRegions = new Map();
    this.focusHistory = [];
    this.skipLinks = [];
    this.init();
  }

  init() {
    // Create ARIA live regions for dynamic content
    this.createLiveRegions();

    // Enhance skip links
    this.enhanceSkipLinks();

    // Keyboard navigation improvements
    this.setupKeyboardNavigation();

    // Focus management for modals/drawers
    this.setupFocusManagement();
  }

  /**
   * Create ARIA live regions for announcements
   */
  createLiveRegions() {
    const regions = {
      status: { priority: 'polite', atomic: true },
      alert: { priority: 'assertive', atomic: true },
      log: { priority: 'polite', atomic: false },
    };

    Object.entries(regions).forEach(([name, config]) => {
      const region = document.createElement('div');
      region.id = `aria-live-${name}`;
      region.setAttribute('role', name === 'alert' ? 'alert' : 'status');
      region.setAttribute('aria-live', config.priority);
      region.setAttribute('aria-atomic', config.atomic.toString());
      region.className = 'visually-hidden';
      region.setAttribute('aria-relevant', 'additions text');

      document.body.appendChild(region);
      this.liveRegions.set(name, region);
    });
  }

  /**
   * Announce message to screen readers
   */
  announce(message, type = 'status', timeout = 5000) {
    const region = this.liveRegions.get(type);
    if (!region) {
      themeLogger.warn('Live region not found:', type);
      return;
    }

    // Clear previous message
    region.textContent = '';

    // Small delay to ensure screen readers pick up the change
    setTimeout(() => {
      region.textContent = message;

      // Clear after timeout (for log type)
      if (type === 'log' && timeout > 0) {
        setTimeout(() => {
          region.textContent = '';
        }, timeout);
      }
    }, 100);
  }

  /**
   * Enhance skip links functionality
   */
  enhanceSkipLinks() {
    const skipLinks = document.querySelectorAll('.skip-to-content-link, [href^="#"]');
    skipLinks.forEach((link) => {
      link.addEventListener('click', (e) => {
        const targetId = link.getAttribute('href').replace('#', '');
        const target = document.getElementById(targetId);

        if (target) {
          e.preventDefault();
          target.setAttribute('tabindex', '-1');
          target.focus();

          // Announce skip
          this.announce(`Skipped to ${target.getAttribute('aria-label') || targetId}`, 'status');
        }
      });
    });
  }

  /**
   * Setup keyboard navigation improvements
   */
  setupKeyboardNavigation() {
    // Trap focus in modals/drawers
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        this.handleFocusTrap(e);
      }

      // Escape key handling
      if (e.key === 'Escape') {
        this.handleEscape(e);
      }
    });

    // Enhance focus indicators
    this.enhanceFocusIndicators();
  }

  /**
   * Handle focus trapping in modals
   */
  handleFocusTrap(e) {
    const modal = document.querySelector('[role="dialog"], details-modal[open], cart-drawer[open]');
    if (!modal) {
      return;
    }

    const focusableElements = this.getFocusableElements(modal);
    if (focusableElements.length === 0) {
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault();
      lastElement.focus();
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault();
      firstElement.focus();
    }
  }

  /**
   * Handle Escape key
   */
  handleEscape(e) {
    const modal = document.querySelector('details-modal[open], cart-drawer[open]');
    if (modal && modal.hasAttribute('open')) {
      modal.removeAttribute('open');
      this.restoreFocus();
    }
  }

  /**
   * Get focusable elements
   */
  getFocusableElements(container) {
    const selector =
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return Array.from(container.querySelectorAll(selector)).filter(
      (el) => el.offsetParent !== null && !el.hasAttribute('hidden')
    );
  }

  /**
   * Enhance focus indicators
   */
  enhanceFocusIndicators() {
    // Add CSS for better focus indicators if not already present
    if (!document.getElementById('accessibility-focus-styles')) {
      const style = document.createElement('style');
      style.id = 'accessibility-focus-styles';
      style.textContent = `
        /* Enhanced focus indicators */
        *:focus-visible {
          outline: 2px solid currentColor;
          outline-offset: 2px;
          border-radius: 2px;
        }
        
        /* Skip links visible on focus */
        .skip-to-content-link:focus {
          position: absolute;
          top: 0;
          left: 0;
          z-index: 9999;
          padding: 1rem;
          background: var(--color-background);
          color: var(--color-foreground);
        }
      `;
      document.head.appendChild(style);
    }
  }

  /**
   * Save current focus before opening modal
   */
  saveFocus() {
    this.focusHistory.push(document.activeElement);
  }

  /**
   * Restore focus after closing modal
   */
  restoreFocus() {
    const previousFocus = this.focusHistory.pop();
    if (previousFocus && typeof previousFocus.focus === 'function') {
      previousFocus.focus();
    }
  }

  /**
   * Setup focus management for dynamic content
   */
  setupFocusManagement() {
    // Watch for dynamically added content
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            // Check if it's a modal or drawer
            if (node.hasAttribute && node.hasAttribute('open')) {
              this.saveFocus();
              this.focusFirstElement(node);
            }

            // Announce new content
            const liveContent = node.querySelector('[data-aria-live]');
            if (liveContent) {
              this.announce(liveContent.textContent, 'status');
            }
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['open'],
    });
  }

  /**
   * Focus first focusable element in container
   */
  focusFirstElement(container) {
    const focusable = this.getFocusableElements(container);
    if (focusable.length > 0) {
      focusable[0].focus();
    }
  }

  /**
   * Announce loading state
   */
  announceLoading(message = 'Loading content...') {
    this.announce(message, 'status');
  }

  /**
   * Announce error
   */
  announceError(message) {
    this.announce(message, 'alert');
  }

  /**
   * Announce success
   */
  announceSuccess(message) {
    this.announce(message, 'status', 3000);
  }
}

// Initialize and export
const accessibilityEnhancer = new AccessibilityEnhancer();
window.accessibilityEnhancer = accessibilityEnhancer;

export default accessibilityEnhancer;
