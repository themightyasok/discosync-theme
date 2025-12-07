/**
 * API Bundle Entry Point
 * This file imports API clients and exposes them globally
 * Vite will bundle this into api-bundle.js (IIFE format)
 */

// Import API clients
import StorefrontAPIClient from './storefront-api-client.js';

// Re-export for bundling
export { StorefrontAPIClient };

// Expose on window (already done in storefront-api-client.js, but ensure it's available)
if (typeof window !== 'undefined') {
  window.StorefrontAPIClient = StorefrontAPIClient;
}

