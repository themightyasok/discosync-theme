/**
 * Theme Constants
 * Centralized configuration and constants for the DiscoSync theme
 */

export const CONFIG = {
  // Storefront API Configuration
  STOREFRONT_API_VERSION: '2025-01',
  STOREFRONT_API_ENDPOINT: (shop) => `https://${shop}/api/2025-01/graphql.json`,

  // Product Grouping Limits
  MAX_PRODUCTS_PER_COLLECTION: 5000,
  BATCH_SIZE: 250,
  RENDER_BATCH_SIZE: 10,

  // Performance Settings
  DEBOUNCE_DELAY: 300,
  FILTER_UPDATE_DELAY: 300,
  SEARCH_DEBOUNCE: 300,

  // Debug Settings
  DEBUG_PARAM: 'debug',
  PERFORMANCE_PARAM: 'perf',
  DEBUG_STORAGE_KEY: 'theme-debug',

  // API Configuration
  METAFIELD_NAMESPACE: 'custom',
  APP_API_ENDPOINT: '/api/metafields',
};

export const SELECTORS = {
  PRODUCT_GRID: '#product-grid',
  FILTER_RESULTS: '#filter-results',
  COLLECTION_HANDLE: '[data-collection-handle]',
  SEARCH_TERMS: '[data-search-terms]',
  GROUPING_ENHANCER: 'collection-grouping-enhancer',
};

export const EVENTS = {
  FILTER_UPDATED: 'on:facet-filters:updated',
  PRODUCT_GROUPED: 'on:products:grouped',
  RENDER_COMPLETE: 'on:render:complete',
  ERROR_OCCURRED: 'on:error:occurred',
};

export const METAFIELD_KEYS = {
  ARTIST: 'artist',
  TITLE: 'title',
  ALBUM: 'album',
  FORMAT: 'format',
  COMPUTED_FORMATS: 'computed_formats',
  MEDIA_CONDITION: 'media_condition',
  SLEEVE_CONDITION: 'sleeve_condition',
  CONDITION: 'condition',
  STYLE_GENRE: 'style_genre',
  COMPUTED_STYLE_GENRE: 'computed_style_genre',
  COMPUTED_MASTER_LABEL: 'computed_master_label',
  LABEL: 'label',
  COMPUTED_LABEL: 'computed_label',
  COMPUTED_OTHER_LABELS: 'computed_other_labels',
  COMPUTED_OTHER_ARTISTS: 'computed_other_artists',
  RELEASED: 'released',
  COMPUTED_RELEASE_YEAR: 'computed_release_year',
  CATNO: 'catno',
  CATALOGUE_NUMBER: 'catalogue_number',
  COLLECTIBILITY_SCORE: 'collectibility_score',
  ENHANCED_KEYWORDS: 'enhanced_keywords',
  LOCATION: 'location',
  HAS_360_VIEW: 'has_360_view',
  TRACKLIST: 'tracklist',
};

export const METAFIELD_TYPES = {
  SINGLE_LINE_TEXT: 'single_line_text_field',
  MULTI_LINE_TEXT: 'multi_line_text_field',
  LIST_SINGLE_LINE_TEXT: 'list.single_line_text_field',
  DATE: 'date',
  BOOLEAN: 'boolean',
};

export const REQUIRED_METAFIELDS = [
  METAFIELD_KEYS.ARTIST,
  METAFIELD_KEYS.TITLE,
  METAFIELD_KEYS.FORMAT,
];

export const ERROR_MESSAGES = {
  STOREFRONT_TOKEN_MISSING:
    'Storefront API token not configured. Add <meta name="shopify-storefront-api-token" content="YOUR_TOKEN"> to theme.liquid. Get your token from: Shopify Admin > Apps > Develop apps > Storefront API',
  API_CLIENT_MISSING:
    'Storefront API client not available. Ensure storefront-api-client.js is loaded.',
  COLLECTION_HANDLE_MISSING: 'Collection handle not found. Cannot group products.',
  PRODUCT_GRID_MISSING: 'Product grid element not found. Cannot render products.',
  FETCH_FAILED: 'Failed to fetch products. Please try again or refresh the page.',
  RENDER_FAILED: 'Failed to render products. Showing fallback view.',
};

// Export default config object for easy access
export default {
  CONFIG,
  SELECTORS,
  EVENTS,
  METAFIELD_KEYS,
  METAFIELD_TYPES,
  REQUIRED_METAFIELDS,
  ERROR_MESSAGES,
};

// Expose on window for global access (after bundling)
if (typeof window !== 'undefined') {
  window.CONFIG = CONFIG;
  window.DiscoSyncConstants = {
    CONFIG,
    SELECTORS,
    EVENTS,
    METAFIELD_KEYS,
    METAFIELD_TYPES,
    REQUIRED_METAFIELDS,
    ERROR_MESSAGES,
  };
}

// Expose on window for global access (after bundling)
if (typeof window !== 'undefined') {
  window.CONFIG = CONFIG;
  window.DiscoSyncConstants = {
    CONFIG,
    SELECTORS,
    EVENTS,
    METAFIELD_KEYS,
    METAFIELD_TYPES,
    REQUIRED_METAFIELDS,
    ERROR_MESSAGES,
  };
}
