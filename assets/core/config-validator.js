/**
 * Configuration Validator
 * Validates theme configuration on load
 */

import { CONFIG, ERROR_MESSAGES } from './constants.js';
import themeLogger from './logger.js';

class ConfigValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Validate all configuration
   */
  validate() {
    this.errors = [];
    this.warnings = [];

    this.validateStorefrontToken();
    this.validateMetafields();
    this.validateAppConfig();

    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings,
    };
  }

  /**
   * Validate Storefront API token
   */
  validateStorefrontToken() {
    const tokenMeta = document.querySelector('meta[name="shopify-storefront-api-token"]');
    
    if (!tokenMeta) {
      this.errors.push({
        type: 'storefront_token_missing',
        message: ERROR_MESSAGES.STOREFRONT_TOKEN_MISSING,
      });
      return;
    }

    const token = tokenMeta.content;
    if (!token || token === 'YOUR_STOREFRONT_API_TOKEN_HERE') {
      this.errors.push({
        type: 'storefront_token_invalid',
        message: ERROR_MESSAGES.STOREFRONT_TOKEN_MISSING,
      });
    }
  }

  /**
   * Check if required metafields exist (via API or DOM inspection)
   */
  validateMetafields() {
    // This is a client-side check - full validation would require API call
    // For now, just check if we can see metafield references in the DOM
    const metafieldReferences = document.querySelectorAll('[data-metafield], [class*="metafield"]');
    
    if (metafieldReferences.length === 0) {
      this.warnings.push({
        type: 'metafields_not_detected',
        message: 'No metafield references detected in DOM. Ensure metafields are created.',
      });
    }
  }

  /**
   * Validate app API configuration (if provided)
   */
  validateAppConfig() {
    const apiUrl = document.querySelector('meta[name="discosync-api-url"]')?.content;
    const storeId = document.querySelector('meta[name="discosync-store-id"]')?.content;
    const apiKey = document.querySelector('meta[name="discosync-api-key"]')?.content;

    const hasPartialConfig = !!(apiUrl || storeId || apiKey);
    const hasFullConfig = !!(apiUrl && storeId && apiKey);

    if (hasPartialConfig && !hasFullConfig) {
      this.warnings.push({
        type: 'app_config_incomplete',
        message: 'App API configuration is incomplete. Automatic metafield creation will not work.',
      });
    }
  }

  /**
   * Display validation results
   */
  displayResults() {
    if (this.errors.length > 0) {
      themeLogger.error('Configuration validation failed:', this.errors);
      
      // Show user-friendly message in console
      console.group('❌ Theme Configuration Errors');
      this.errors.forEach(error => {
        console.error(`• ${error.type}: ${error.message}`);
      });
      console.groupEnd();
    }

    if (this.warnings.length > 0) {
      themeLogger.warn('Configuration validation warnings:', this.warnings);
      
      if (themeLogger.isDebug) {
        console.group('⚠️ Theme Configuration Warnings');
        this.warnings.forEach(warning => {
          console.warn(`• ${warning.type}: ${warning.message}`);
        });
        console.groupEnd();
      }
    }

    if (this.errors.length === 0 && this.warnings.length === 0) {
      themeLogger.debug('Configuration validation passed');
    }
  }
}

// Initialize and run validation if in debug mode
const configValidator = new ConfigValidator();

// Run validation on load if debug mode is enabled
if (themeLogger.isDebug) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      const results = configValidator.validate();
      configValidator.displayResults();
    });
  } else {
    const results = configValidator.validate();
    configValidator.displayResults();
  }
}

window.configValidator = configValidator;

export default configValidator;

