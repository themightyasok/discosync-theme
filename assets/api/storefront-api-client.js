/**
 * Shopify Storefront API Client for Product Filtering
 * Handles all GraphQL queries for filtering products in large collections
 */

import { CONFIG, ERROR_MESSAGES } from '../core/constants.js';
import themeLogger from '../core/logger.js';
import perfMonitor from '../core/performance-monitor.js';

class StorefrontAPIClient {
  constructor() {
    const shop = window.Shopify?.shop || '';
    this.endpoint = CONFIG.STOREFRONT_API_ENDPOINT(shop);
    this.token = this.getStorefrontToken();

    if (!this.token) {
      themeLogger.error(ERROR_MESSAGES.STOREFRONT_TOKEN_MISSING);
    }
  }

  /**
   * Get Storefront API access token from meta tag
   */
  getStorefrontToken() {
    const meta = document.querySelector('meta[name="shopify-storefront-api-token"]');
    if (!meta) {
      return null;
    }
    return meta.content;
  }

  /**
   * Execute GraphQL query
   */
  async query(graphqlQuery, variables = {}) {
    if (!this.token) {
      throw new Error(ERROR_MESSAGES.STOREFRONT_TOKEN_MISSING);
    }

    return perfMonitor.measureAsync(
      'Storefront API Query',
      async () => {
        const response = await fetch(this.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Storefront-Access-Token': this.token,
          },
          body: JSON.stringify({
            query: graphqlQuery,
            variables,
          }),
        });

        const result = await response.json();

        if (result.errors) {
          themeLogger.error('GraphQL Errors:', result.errors);
          throw new Error(result.errors[0].message);
        }

        return result.data;
      },
      { queryName: variables.operationName || 'unknown' }
    );
  }

  /**
   * Get collection with products and filters
   */
  async getCollection(handle, filters = [], cursor = null, limit = 24) {
    const query = `
      query GetCollection($handle: String!, $filters: [ProductFilter!], $first: Int!, $after: String) {
        collection(handle: $handle) {
          id
          handle
          title
          products(first: $first, after: $after, filters: $filters) {
            edges {
              cursor
              node {
                id
                handle
                title
                productType
                vendor
                tags
                priceRange {
                  minVariantPrice {
                    amount
                    currencyCode
                  }
                  maxVariantPrice {
                    amount
                    currencyCode
                  }
                }
                featuredImage {
                  url
                  altText
                  width
                  height
                }
                availableForSale
                compareAtPriceRange {
                  minVariantPrice {
                    amount
                    currencyCode
                  }
                }
                variants(first: 10) {
                  edges {
                    node {
                      id
                      title
                      availableForSale
                      priceV2 {
                        amount
                        currencyCode
                      }
                      compareAtPriceV2 {
                        amount
                        currencyCode
                      }
                      selectedOptions {
                        name
                        value
                      }
                    }
                  }
                }
                media_condition: metafield(namespace: "custom", key: "media_condition") {
                  value
                }
                sleeve_condition: metafield(namespace: "custom", key: "sleeve_condition") {
                  value
                }
                style_genre: metafield(namespace: "custom", key: "computed_style_genre") {
                  value
                }
                artist: metafield(namespace: "custom", key: "artist") {
                  value
                }
                title_metafield: metafield(namespace: "custom", key: "title") {
                  value
                }
              }
            }
            pageInfo {
              hasNextPage
              hasPreviousPage
              endCursor
              startCursor
            }
          }
        }
      }
    `;

    const variables = {
      handle,
      filters,
      first: limit,
      after: cursor || undefined,
    };

    return await this.query(query, variables);
  }

  /**
   * Search products using Storefront API
   * Uses GraphQL products query with query parameter for search
   * Note: The root products field doesn't support filters, only query
   */
  async searchProducts(query, cursor = null, limit = 24) {
    const graphqlQuery = `
      query SearchProducts($query: String!, $first: Int!, $after: String) {
        products(first: $first, after: $after, query: $query) {
          edges {
            cursor
            node {
              id
              handle
              title
              productType
              vendor
              tags
              priceRange {
                minVariantPrice {
                  amount
                  currencyCode
                }
                maxVariantPrice {
                  amount
                  currencyCode
                }
              }
              featuredImage {
                url
                altText
                width
                height
              }
              availableForSale
              compareAtPriceRange {
                minVariantPrice {
                  amount
                  currencyCode
                }
              }
              variants(first: 10) {
                edges {
                  node {
                    id
                    title
                    availableForSale
                    priceV2 {
                      amount
                      currencyCode
                    }
                    compareAtPriceV2 {
                      amount
                      currencyCode
                    }
                    selectedOptions {
                      name
                      value
                    }
                  }
                }
              }
              media_condition: metafield(namespace: "custom", key: "media_condition") {
                value
              }
              sleeve_condition: metafield(namespace: "custom", key: "sleeve_condition") {
                value
              }
              style_genre: metafield(namespace: "custom", key: "computed_style_genre") {
                value
              }
              artist: metafield(namespace: "custom", key: "artist") {
                value
              }
              title_metafield: metafield(namespace: "custom", key: "title") {
                value
              }
            }
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
            endCursor
            startCursor
          }
        }
      }
    `;

    const variables = {
      query,
      first: limit,
      after: cursor || undefined,
    };

    const data = await this.query(graphqlQuery, variables);
    return {
      products: data.products,
    };
  }

  /**
   * Build filter input from URL parameters or user selection
   * Now handles arrays of values
   */
  buildFilters(params) {
    const filters = [];

    // Product Type filter (can be array)
    if (params.productType) {
      const types = Array.isArray(params.productType) ? params.productType : [params.productType];
      types.forEach((type) => {
        filters.push({ productType: type });
      });
    }

    // Price range filter
    if (params.priceMin || params.priceMax) {
      filters.push({
        price: {
          min: params.priceMin ? parseFloat(params.priceMin) : undefined,
          max: params.priceMax ? parseFloat(params.priceMax) : undefined,
        },
      });
    }

    // Style/Genre filter - can be metafield or variant option, check both
    if (params.styleGenre) {
      const genres = Array.isArray(params.styleGenre) ? params.styleGenre : [params.styleGenre];
      genres.forEach((genre) => {
        // Try as product metafield first (most likely)
        filters.push({
          productMetafield: {
            namespace: 'custom',
            key: 'computed_style_genre',
            value: genre,
          },
        });
        // Note: If style_genre is actually a variant option in Shopify,
        // we'd need to use variantOption instead, but metafield is more common
      });
    }

    // Metafield filters - can be array
    if (params.mediaCondition) {
      const conditions = Array.isArray(params.mediaCondition)
        ? params.mediaCondition
        : [params.mediaCondition];
      conditions.forEach((condition) => {
        filters.push({
          productMetafield: {
            namespace: 'custom',
            key: 'media_condition',
            value: condition,
          },
        });
      });
    }

    if (params.sleeveCondition) {
      const conditions = Array.isArray(params.sleeveCondition)
        ? params.sleeveCondition
        : [params.sleeveCondition];
      conditions.forEach((condition) => {
        filters.push({
          productMetafield: {
            namespace: 'custom',
            key: 'sleeve_condition',
            value: condition,
          },
        });
      });
    }

    return filters;
  }

  /**
   * Parse URL parameters into filter object (handles comma-separated values AND multiple params with same name)
   */
  parseURLFilters() {
    const params = new URLSearchParams(window.location.search);

    // Debug: Log all filter parameters (will be logged to debug panel via CollectionGroupingEnhancer)
    const allFilterParams = Array.from(params.entries()).filter(([key]) =>
      key.startsWith('filter.')
    );

    const parseParam = (value) => {
      if (!value) {
        return null;
      }
      return value.includes(',') ? value.split(',') : value;
    };

    // Use getAll() to get ALL values for parameters that can appear multiple times
    // This handles URLs like: ?filter.p.product_type=7"+Singles&filter.p.product_type=CD+Albums
    const getAllParam = (key) => {
      const allValues = params.getAll(key);

      if (allValues.length === 0) {
        // Try URL-decoded version in case of encoding issues
        const decodedKey = decodeURIComponent(key);
        if (decodedKey !== key) {
          const decodedValues = params.getAll(decodedKey);
          if (decodedValues.length > 0) {
            // Use decoded values
            const combined = [];
            decodedValues.forEach((val) => {
              if (val.includes(',')) {
                combined.push(...val.split(','));
              } else {
                combined.push(val);
              }
            });
            return combined.length === 1 ? combined[0] : combined;
          }
        }
        return null;
      }

      if (allValues.length === 1) {
        // Single value - check if it's comma-separated
        return parseParam(allValues[0]);
      }
      // Multiple values - combine them (they're already separate, so just return array)
      // Also handle comma-separated values within each
      const combined = [];
      allValues.forEach((val) => {
        if (val.includes(',')) {
          combined.push(...val.split(','));
        } else {
          combined.push(val);
        }
      });
      return combined.length === 1 ? combined[0] : combined;
    };

    // Helper to get a param with fallback to alternative format
    const getParamWithFallback = (primaryKey, fallbackKey) => {
      const primary = getAllParam(primaryKey);
      if (primary) {
        return primary;
      }
      if (fallbackKey) {
        const fallback = getAllParam(fallbackKey);
        if (fallback) {
          return fallback;
        }
      }
      return null;
    };

    const result = {
      productType: getAllParam('filter.p.product_type'),
      priceMin: params.get('filter.v.price.gte'),
      priceMax: params.get('filter.v.price.lte'),
      // Style/Genre could be metafield or variant option - check both formats
      // Try metafield formats first, then variant option format
      styleGenre: (() => {
        const metafield = getParamWithFallback(
          'filter.p.m.custom.computed_style_genre',
          'filter.p.m.custom.style_genre'
        );
        if (metafield) {
          return metafield;
        }
        return getAllParam('filter.v.option.style_genre');
      })(),
      // Product metafields use filter.p.m.custom.* format, not filter.v.option.*
      mediaCondition: getParamWithFallback(
        'filter.p.m.custom.media_condition',
        'filter.v.option.media_condition'
      ),
      sleeveCondition: getParamWithFallback(
        'filter.p.m.custom.sleeve_condition',
        'filter.v.option.sleeve_condition'
      ),
    };

    return result;
  }

  /**
   * Update URL with current filters (handles arrays)
   */
  updateURL(filterParams) {
    const url = new URL(window.location);

    // Clear existing filter params
    Array.from(url.searchParams.keys()).forEach((key) => {
      if (key.startsWith('filter.')) {
        url.searchParams.delete(key);
      }
    });

    // Add new filter params (handle arrays by joining with comma)
    if (filterParams.productType) {
      const value = Array.isArray(filterParams.productType)
        ? filterParams.productType.join(',')
        : filterParams.productType;
      url.searchParams.set('filter.p.product_type', value);
    }
    if (filterParams.priceMin) {
      url.searchParams.set('filter.v.price.gte', filterParams.priceMin);
    }
    if (filterParams.priceMax) {
      url.searchParams.set('filter.v.price.lte', filterParams.priceMax);
    }
    if (filterParams.styleGenre) {
      const value = Array.isArray(filterParams.styleGenre)
        ? filterParams.styleGenre.join(',')
        : filterParams.styleGenre;
      // Try metafield format first (most common), fallback to variant option
      // Note: This should match what Shopify actually uses - may need adjustment
      url.searchParams.set('filter.p.m.custom.computed_style_genre', value);
    }
    if (filterParams.mediaCondition) {
      const value = Array.isArray(filterParams.mediaCondition)
        ? filterParams.mediaCondition.join(',')
        : filterParams.mediaCondition;
      // Product metafields use filter.p.m.custom.* format
      url.searchParams.set('filter.p.m.custom.media_condition', value);
    }
    if (filterParams.sleeveCondition) {
      const value = Array.isArray(filterParams.sleeveCondition)
        ? filterParams.sleeveCondition.join(',')
        : filterParams.sleeveCondition;
      // Product metafields use filter.p.m.custom.* format
      url.searchParams.set('filter.p.m.custom.sleeve_condition', value);
    }

    window.history.pushState({}, '', url);
  }
}

// Export for use in other modules and expose globally
window.StorefrontAPIClient = StorefrontAPIClient;
export default StorefrontAPIClient;
