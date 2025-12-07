/**
 * Error Boundary Utility
 * Provides graceful error handling and fallback UI
 */

import themeLogger from './logger.js';
import { ERROR_MESSAGES } from './constants.js';

class ErrorBoundary {
  constructor(element, fallbackCallback) {
    this.element = element;
    this.fallbackCallback = fallbackCallback;
    this.hasError = false;
  }

  /**
   * Wrap async function with error handling
   */
  async wrapAsync(asyncFn, errorMessage = ERROR_MESSAGES.FETCH_FAILED) {
    try {
      return await asyncFn();
    } catch (error) {
      this.handleError(error, errorMessage);
      return null;
    }
  }

  /**
   * Handle error gracefully
   */
  handleError(error, userMessage) {
    this.hasError = true;
    themeLogger.error(userMessage, error);
    
    // Show fallback UI if element exists
    if (this.element && this.fallbackCallback) {
      this.fallbackCallback(this.element, error, userMessage);
    }
  }

  /**
   * Show error state in element
   */
  showErrorState(message, details = null) {
    if (!this.element) return;

    const errorHTML = `
      <div class="error-state" role="alert">
        <p class="error-state__message">${message}</p>
        ${details && themeLogger.isDebug ? `<pre class="error-state__details">${details}</pre>` : ''}
        <button class="error-state__retry" onclick="location.reload()">Try Again</button>
      </div>
    `;

    this.element.innerHTML = errorHTML;
  }

  /**
   * Show fallback content
   */
  showFallback(fallbackHTML) {
    if (!this.element) return;
    this.element.innerHTML = fallbackHTML;
  }

  /**
   * Reset error state
   */
  reset() {
    this.hasError = false;
    if (this.element) {
      const errorState = this.element.querySelector('.error-state');
      if (errorState) {
        errorState.remove();
      }
    }
  }
}

export default ErrorBoundary;

