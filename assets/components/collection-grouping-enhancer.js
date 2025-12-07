/**
 * ============================================================================
 * Collection Grouping Enhancer
 * ============================================================================
 * 
 * PURPOSE:
 * Groups products in collections by artist + album + format, then renders
 * them using Shopify's Section Rendering API to ensure server-side rendering
 * matches the original Liquid-rendered cards exactly.
 * 
 * FLOW:
 * 1. Fetch ALL products from collection via Storefront API (handles pagination)
 * 2. Group products by artist|album|format (case-insensitive, normalized)
 * 3. For each group/single, call Section Rendering API to get server-rendered card
 * 4. Extract card HTML and insert into DOM
 * 5. Reinitialize components (carousels, animations, etc.)
 * 
 * KEY FEATURES:
 * - Works for collections up to 5,000 products (configurable limit)
 * - Groups ALL products in one pass (not paginated)
 * - Uses Section Rendering API for server-side rendering (matches Liquid cards exactly)
 * - No client-side fallbacks - API must work correctly
 * - Tracks metrics for performance monitoring
 * 
 * DEPENDENCIES:
 * - StorefrontAPIClient (assets/storefront-api-client.js)
 * - Section: sections/product-group-card-renderer.liquid
 * - Snippet: snippets/product-group-card.liquid
 * ============================================================================
 */
if (!customElements.get('collection-grouping-enhancer')) {
  class CollectionGroupingEnhancer extends HTMLElement {
    constructor() {
      super();
      this.sectionId = this.dataset.sectionId;
      this.collectionHandle = this.dataset.collectionHandle;
      // Get search terms from data attribute, or fallback to URL parameter
      this.searchTerms = this.dataset.searchTerms || this.getSearchTermsFromURL() || '';
      this.isSearchMode = !!this.searchTerms;
      this.cardSize = this.dataset.cardSize || 'medium';
      this.cardPriceBottom = this.dataset.cardPriceBottom === 'true';
      this.enableQuickAdd = this.dataset.enableQuickAdd !== 'false'; // Default to true
      this.cardContain = this.dataset.cardContain === 'true';
      this.showDividers = this.dataset.showDividers === 'true';
      this.useJsGrouping = this.dataset.useJsGrouping === 'true';
      this.apiClient = null;
      this.isEnhancing = false; // Flag to prevent concurrent enhance() calls
      this.filterUpdateTimeout = null; // For debouncing rapid filter changes
      
      // Listen for filter updates to re-run grouping
      this.handleFilterUpdate = this.handleFilterUpdate.bind(this);
      document.addEventListener('on:facet-filters:updated', (event) => {
        this.handleFilterUpdate(event);
      });
      
      // Create debug panel for on-screen logging
      this.createDebugPanel();
      
      this.init();
    }
    
    /**
     * Extract search terms from URL as fallback
     */
    getSearchTermsFromURL() {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('q') || '';
    }
    
    /**
     * Handle filter updates - re-run grouping when filters are applied
     */
    async handleFilterUpdate(event) {
      this.debugLog('🟢 CollectionGroupingEnhancer: handleFilterUpdate called');
      
      // Reset enhancing flag to allow interruption of current enhancement
      // This is necessary because filters can be applied while initial enhancement is still running
      if (this.isEnhancing) {
        this.debugLog('🟡 CollectionGroupingEnhancer: Interrupting current enhancement for filter update');
      }
      this.isEnhancing = false;
      
      // IMMEDIATELY hide the grid to prevent Liquid cards from flashing
      // Do this before waiting for DOM to settle
      const filterResults = document.querySelector('#filter-results');
      let grid = document.querySelector('#product-grid');
      if (!grid && filterResults) {
        grid = filterResults.querySelector('ul');
        if (!grid) {
          const container = filterResults.querySelector('.products-grid-container, .container');
          grid = container ? container.querySelector('ul') : null;
        }
      }
      if (grid) {
        grid.style.display = 'none';
        grid.classList.add('js-grouping-hidden');
        this.debugLog('🟢 CollectionGroupingEnhancer: Grid hidden immediately to prevent flash');
      }
      
      // Debounce rapid changes
      if (this.filterUpdateTimeout) {
        clearTimeout(this.filterUpdateTimeout);
      }
      
      // Wait for DOM to settle
      await new Promise(resolve => {
        this.filterUpdateTimeout = setTimeout(resolve, 300);
      });
      this.filterUpdateTimeout = null;
      
      this.debugLog('🟢 CollectionGroupingEnhancer: Looking for grid...');
      
      // Find the grid (it may have been replaced by facet-filters.js)
      // Reuse the grid variable we found earlier, or try to find it again
      if (!grid) {
        grid = document.querySelector('#product-grid');
        const filterResultsAfter = document.querySelector('#filter-results');
        if (!grid && filterResultsAfter) {
          const foundGrid = filterResultsAfter.querySelector('ul');
          if (foundGrid) {
            grid = foundGrid;
          } else {
            const container = filterResultsAfter.querySelector('.products-grid-container, .container');
            grid = container ? container.querySelector('ul') : null;
          }
        }
      }
      if (!grid) {
        this.debugLog('🔴 CollectionGroupingEnhancer: Grid ul not found');
        return;
      }
      
        // Announce loading to screen readers
        if (window.accessibilityEnhancer) {
          window.accessibilityEnhancer.announceLoading('Loading and grouping products...');
        }
        
        this.debugLog('🟢 CollectionGroupingEnhancer: Grid found, clearing and re-grouping...');
      
      // Remove js-grouping-hidden if present
      grid.classList.remove('js-grouping-hidden');
      if (grid.style.display === 'none') {
        grid.style.display = '';
      }
      
      // Store grid attributes
      const gridClasses = grid.className;
      const gridAttrs = {};
      Array.from(grid.attributes).forEach(attr => {
        gridAttrs[attr.name] = attr.value;
      });
      
      // Clear Liquid products
      grid.innerHTML = '';
      
      // Restore attributes
      grid.className = gridClasses;
      Object.keys(gridAttrs).forEach(name => {
        grid.setAttribute(name, gridAttrs[name]);
      });
      grid.classList.remove('js-grouping-hidden');
      
      // Ensure grouping is enabled
      this.useJsGrouping = true;
      
      // Ensure apiClient exists
      if (!this.apiClient && typeof StorefrontAPIClient !== 'undefined') {
        this.apiClient = new StorefrontAPIClient();
      }
      if (!this.apiClient) {
        this.debugLog('🔴 CollectionGroupingEnhancer: No apiClient');
        return;
      }
      
      // Recover collectionHandle if lost
      if (!this.isSearchMode && !this.collectionHandle) {
        const match = window.location.pathname.match(/\/collections\/([^/]+)/);
        if (match) {
          this.collectionHandle = match[1];
          this.debugLog('🟢 CollectionGroupingEnhancer: Recovered collectionHandle:', this.collectionHandle);
        } else {
          this.debugLog('🔴 CollectionGroupingEnhancer: No collectionHandle');
          return;
        }
      }
      
      // Reset state
      this.isEnhancing = false;
      this.allFetchedProducts = [];
      this.renderedProductIds = new Set();
      this.groupMap = new Map();
      this.productMap = new Map();
      this.allProductsMap = new Map();
      this.originalProductOrder = new Map();
      this.renderedCount = 0;
      
      this.debugLog('🟢 CollectionGroupingEnhancer: Calling enhance()...');
      // Re-run grouping
      await this.enhance();
      this.debugLog('🟢 CollectionGroupingEnhancer: enhance() completed');
    }

    /**
     * Create a debug panel for on-screen logging
     */
    /**
     * Create a debug panel for on-screen logging
     */
    createDebugPanel() {
      // Remove any existing debug panels
      const existingPanel = document.getElementById('grouping-debug-panel');
      if (existingPanel) existingPanel.remove();
      
      const panel = document.createElement('div');
      panel.id = 'grouping-debug-panel';
      panel.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        width: 400px;
        max-height: 300px;
        background: rgba(0, 0, 0, 0.9);
        color: #00ff00;
        font-family: monospace;
        font-size: 11px;
        padding: 10px;
        border-radius: 5px;
        z-index: 10000;
        overflow-y: auto;
        border: 1px solid #333;
      `;
      
      const header = document.createElement('div');
      header.style.cssText = 'color: #fff; font-weight: bold; margin-bottom: 5px; border-bottom: 1px solid #333; padding-bottom: 5px;';
      header.textContent = 'Collection Grouping Debug';
      
      const closeBtn = document.createElement('button');
      closeBtn.textContent = '×';
      closeBtn.style.cssText = 'float: right; background: none; border: none; color: #fff; font-size: 16px; cursor: pointer;';
      closeBtn.onclick = () => panel.remove();
      header.appendChild(closeBtn);
      
      const logContainer = document.createElement('div');
      logContainer.id = 'debug-log-container';
      logContainer.style.cssText = 'max-height: 250px; overflow-y: auto;';
      
      panel.appendChild(header);
      panel.appendChild(logContainer);
      document.body.appendChild(panel);
      
      this.debugPanel = panel;
      this.logContainer = logContainer;
    }

    /**
     * Debug logging (logger + on-screen panel)
     */
    debugLog(message, data = null) {
      // Use theme logger if available, fallback to console
      if (window.themeLogger) {
        if (data !== null) {
          window.themeLogger.debug(message, data);
        } else {
          window.themeLogger.debug(message);
        }
      } else {
        // Fallback to console if logger not loaded yet
        if (data !== null) {
          window.themeLogger?.log(message, data);
        } else {
          window.themeLogger?.log(message);
        }
      }
      
      // Log to on-screen panel
      if (this.logContainer) {
        const logEntry = document.createElement('div');
        logEntry.style.cssText = 'margin-bottom: 2px; word-wrap: break-word;';
        
        // Color code different log levels
        if (message.includes('🔴')) {
          logEntry.style.color = '#ff6b6b';
        } else if (message.includes('🟡')) {
          logEntry.style.color = '#ffd93d';
        } else if (message.includes('🟢')) {
          logEntry.style.color = '#6bcf7f';
        } else if (message.includes('🟣')) {
          logEntry.style.color = '#da77f2';
        } else {
          logEntry.style.color = '#00ff00';
        }
        
        const timestamp = new Date().toLocaleTimeString();
        let logText = `[${timestamp}] ${message}`;
        
        if (data !== null) {
          logText += ` ${JSON.stringify(data, null, 2)}`;
        }
        
        logEntry.textContent = logText;
        this.logContainer.appendChild(logEntry);
        
        // Auto-scroll to bottom
        this.logContainer.scrollTop = this.logContainer.scrollHeight;
        
        // Limit log entries to prevent memory issues
        if (this.logContainer.children.length > 100) {
          this.logContainer.removeChild(this.logContainer.firstChild);
        }
      }
    }

    async init() {
      this.debugLog('🔵 CollectionGroupingEnhancer: init() called');
      
      // Wait for StorefrontAPIClient to be available
      if (typeof StorefrontAPIClient === 'undefined') {
        this.debugLog('🔵 CollectionGroupingEnhancer: StorefrontAPIClient not found, retrying in 100ms...');
        setTimeout(() => this.init(), 100);
        return;
      }

      this.debugLog('🔵 CollectionGroupingEnhancer: StorefrontAPIClient found, creating instance');
      this.apiClient = new StorefrontAPIClient();
      this.debugLog('🔵 CollectionGroupingEnhancer: API client created:', !!this.apiClient);

      if (document.readyState === 'loading') {
        this.debugLog('🔵 CollectionGroupingEnhancer: Document still loading, waiting for DOMContentLoaded');
        document.addEventListener('DOMContentLoaded', () => {
          this.debugLog('🔵 CollectionGroupingEnhancer: DOMContentLoaded fired, calling enhance()');
          this.enhance();
        });
      } else {
        this.debugLog('🔵 CollectionGroupingEnhancer: Document ready, calling enhance() immediately');
        this.enhance();
      }
    }

    /**
     * Check if filters are active (Shopify native or URL params)
     * @returns {boolean} - true if any filters are active
     */
    hasActiveFilters() {
      // Check for Shopify native filters in URL
      const urlParams = new URLSearchParams(window.location.search);
      const hasFilterParams = Array.from(urlParams.keys()).some(key => key.startsWith('filter.'));
      
      // Check for custom filter params
      const hasCustomFilters = urlParams.has('artist') || urlParams.has('year') || 
                               urlParams.has('label') || urlParams.has('genre') || urlParams.has('format');
      
      // Check if collection.filters would have active values (we can't access this directly in JS,
      // but we can check the DOM for active filter indicators)
      const activeFilterElements = document.querySelectorAll('.facet-filters input:checked, .storefront-filters input:checked, [data-filter-active="true"]');
      const hasActiveFilterElements = activeFilterElements.length > 0;
      
      return hasFilterParams || hasCustomFilters || hasActiveFilterElements;
    }

    async enhance() {
      // Prevent concurrent execution
      if (this.isEnhancing) {
        this.debugLog('🟡 CollectionGroupingEnhancer: Enhancement already in progress');
        return;
      }
      
      this.isEnhancing = true;
      
      try {
        // Hide pagination "showing X out of Y" message
        const paginationMessage = document.querySelector('.js-pagination-message');
        if (paginationMessage) {
          paginationMessage.style.display = 'none';
        }
        
        // CRITICAL: Check if JS grouping should run
        if (!this.useJsGrouping) {
          this.debugLog('🟡 CollectionGroupingEnhancer: JS grouping disabled (filters active or collection too large)');
          this.showLiquidProducts(); // Show Liquid-rendered products
          return;
        }
      
        if (!this.apiClient) {
          this.debugLog('🔴 CollectionGroupingEnhancer: Missing apiClient');
          // Try to create it again
          if (typeof StorefrontAPIClient !== 'undefined') {
            this.apiClient = new StorefrontAPIClient();
            this.debugLog('🟢 CollectionGroupingEnhancer: Created apiClient on retry');
          } else {
            this.debugLog('🔴 CollectionGroupingEnhancer: StorefrontAPIClient not available');
            return;
          }
        }
      
        if (!this.isSearchMode && !this.collectionHandle) {
          this.debugLog('🔴 CollectionGroupingEnhancer: Missing collectionHandle for collection mode');
          // Try to extract from URL
          const match = window.location.pathname.match(/\/collections\/([^/]+)/);
          if (match) {
            this.collectionHandle = match[1];
            this.debugLog('🟢 CollectionGroupingEnhancer: Recovered collectionHandle from URL:', this.collectionHandle);
          } else {
            this.debugLog('🔴 CollectionGroupingEnhancer: Not a collection page, cannot proceed');
            return;
          }
        }
      
        if (this.isSearchMode && !this.searchTerms) {
          this.debugLog('🔴 CollectionGroupingEnhancer: Missing searchTerms for search mode');
          this.debugLog('🔴 CollectionGroupingEnhancer: URL params:', window.location.search);
          this.debugLog('🔴 CollectionGroupingEnhancer: dataset.searchTerms:', this.dataset.searchTerms);
          this.debugLog('🔴 CollectionGroupingEnhancer: getSearchTermsFromURL():', this.getSearchTermsFromURL());
          // Don't fallback - fix the search terms detection
          const urlParams = new URLSearchParams(window.location.search);
          this.searchTerms = urlParams.get('q') || '';
          if (this.searchTerms) {
            this.debugLog('🟢 CollectionGroupingEnhancer: Recovered search terms from URL:', this.searchTerms);
          } else {
            this.debugLog('🔴 CollectionGroupingEnhancer: Still no search terms found');
            return;
          }
        }
        if (this.isSearchMode) {
          this.debugLog('🟢 CollectionGroupingEnhancer: Starting PROGRESSIVE enhancement for search:', this.searchTerms);
          this.debugLog('🟢 CollectionGroupingEnhancer: Search mode detected, isSearchMode:', this.isSearchMode);
        } else {
          this.debugLog('🟢 CollectionGroupingEnhancer: Starting PROGRESSIVE enhancement for collection:', this.collectionHandle);
        }
        
        // Extract filters from URL and build Storefront API filters
        const filterParams = this.apiClient.parseURLFilters();
        const apiFilters = this.apiClient.buildFilters(filterParams);
        this.debugLog('🟢 CollectionGroupingEnhancer: Using filters:', JSON.stringify(apiFilters));
        this.debugLog('🟢 CollectionGroupingEnhancer: Filter params from URL:', JSON.stringify(filterParams));
        
        // Initialize state for progressive loading
        this.allFetchedProducts = [];
        this.renderedProductIds = new Set();
        this.groupMap = new Map(); // Track groups as they're built
        this.productMap = new Map(); // Track all products for grouping
        this.originalProductOrder = new Map();
        this.currentIndex = 0;
        
        // Initialize grid - try multiple selectors to work with both collection and search pages
        // Also check #filter-results for when filters have been applied, and Dawn's #product-grid
        let existingGrid = document.querySelector('#product-grid, .main-products-grid__results ul, .main-products-grid__results .products-grid-container ul, #ProductGridContainer ul, #filter-results ul');
        if (!existingGrid) {
          // Try finding via filter-results container
          const filterResults = document.querySelector('#filter-results');
          if (filterResults) {
            existingGrid = filterResults.querySelector('ul');
            if (!existingGrid) {
              const gridContainer = filterResults.querySelector('.products-grid-container, .container');
              existingGrid = gridContainer ? gridContainer.querySelector('ul') : null;
            }
          }
        }
        
        if (!existingGrid) {
          // Announce error to screen readers
          if (window.accessibilityEnhancer) {
            window.accessibilityEnhancer.announceError('Product grid not found. Unable to display products.');
          }
          
          this.debugLog('🔴 CollectionGroupingEnhancer: Product grid not found');
          this.debugLog('🔴 CollectionGroupingEnhancer: Available selectors:', {
            'main-products-grid__results': !!document.querySelector('.main-products-grid__results'),
            'filter-results': !!document.querySelector('#filter-results'),
            'filter-results-ul': !!document.querySelector('#filter-results ul')
          });
          throw new Error('Product grid not found');
        }
        
        this.debugLog('🟢 CollectionGroupingEnhancer: Found grid for enhancement');
        this.debugLog('🟢 CollectionGroupingEnhancer: Grid has', existingGrid.children.length, 'Liquid products');
        
        // Store original grid classes and attributes
        const originalGridClasses = existingGrid.className;
        const originalGridAttributes = {};
        Array.from(existingGrid.attributes).forEach(attr => {
          originalGridAttributes[attr.name] = attr.value;
        });
        
        // Clear grid but preserve structure
        // This is critical - clear Liquid-rendered products even on initial load with filters
        existingGrid.innerHTML = '';
        existingGrid.className = originalGridClasses;
        Object.keys(originalGridAttributes).forEach(attrName => {
          existingGrid.setAttribute(attrName, originalGridAttributes[attrName]);
        });
        existingGrid.classList.remove('js-grouping-hidden');
        if (existingGrid.style.display === 'none') {
          existingGrid.style.display = '';
        }
        this.debugLog('🟢 CollectionGroupingEnhancer: Cleared Liquid products, ready for JS grouping');
        
        // Get settings
        this.enableCompare = document.querySelector('[data-compare]')?.dataset.compare === 'true' || false;
        this.cardSize = this.cardSize || 'medium';
        this.allProductsMap = new Map();
        
        // Start progressive loading
        // For search mode, don't pass filters to API (Search API doesn't support them)
        // But we'll apply client-side filtering after fetching
        const filtersToUse = this.isSearchMode ? [] : apiFilters;
        await this.loadProductsProgressively(filtersToUse, existingGrid, this.isSearchMode ? filterParams : null);
        
        // CRITICAL: Ensure grid is visible after products are loaded
        if (existingGrid) {
          existingGrid.classList.remove('js-grouping-hidden');
          if (existingGrid.style.display === 'none') {
            existingGrid.style.display = '';
          }
          const productCount = existingGrid.children.length;
          this.debugLog(`🟢 CollectionGroupingEnhancer: Grid visibility check - children: ${productCount}, display: ${window.getComputedStyle(existingGrid).display}, hidden class: ${existingGrid.classList.contains('js-grouping-hidden')}`);
          
          if (productCount === 0) {
            this.debugLog('🔴 CollectionGroupingEnhancer: WARNING - No products rendered!');
            this.debugLog('🔴 CollectionGroupingEnhancer: Grid classes:', existingGrid.className);
            this.debugLog('🔴 CollectionGroupingEnhancer: Grid innerHTML length:', existingGrid.innerHTML.length);
            this.debugLog('🔴 CollectionGroupingEnhancer: Grid parent:', existingGrid.parentElement);
            // Force grid to be visible anyway
            existingGrid.classList.remove('js-grouping-hidden');
            existingGrid.style.display = '';
            return;
          }
        }
        
        // Hide pagination (JS shows all products, no pagination needed)
        this.hidePagination();

        // Reinitialize components
        this.reinitializeComponents();
        
        // Announce completion to screen readers
        if (window.accessibilityEnhancer) {
          const totalItems = this.renderedCount || groupedData.groups.length + groupedData.singles.length;
          window.accessibilityEnhancer.announceSuccess(`Products loaded: ${totalItems} items displayed.`);
        }
        
        this.debugLog('🟢 CollectionGroupingEnhancer: Progressive enhancement complete');
      } catch (error) {
        this.debugLog('🔴 CollectionGroupingEnhancer: CRITICAL ERROR - Grouping failed:', error.message);
        this.debugLog('🔴 CollectionGroupingEnhancer: Stack trace:', error.stack);
        
        // Graceful fallback: Show Liquid-rendered products
        this.debugLog('🟡 CollectionGroupingEnhancer: Falling back to Liquid-rendered products');
        this.showLiquidProducts();
      }
    }
    
    /**
     * Show Liquid-rendered products (fallback if JS fails or filters active)
     */
    showLiquidProducts() {
      const hiddenGrid = document.querySelector('.js-grouping-hidden');
      if (hiddenGrid) {
        hiddenGrid.classList.remove('js-grouping-hidden');
        hiddenGrid.style.display = ''; // Remove any inline display:none
      }
    }
    
    /**
     * Hide pagination controls (JS shows all products, no pagination needed)
     */
    hidePagination() {
      const pagination = document.querySelector('.js-pagination, .pagination');
      if (pagination) {
        pagination.style.display = 'none';
      }
      
      // Also hide load more button if it exists
      const loadMoreButton = document.querySelector('.js-pagination-load-more');
      if (loadMoreButton) {
        loadMoreButton.style.display = 'none';
      }
      
      // Disable infinite scroll on custom-pagination component
      const customPagination = document.querySelector('custom-pagination');
      if (customPagination && customPagination.dataset) {
        customPagination.dataset.pauseInfiniteScroll = 'true';
      }
    }

    /**
     * Progressive loading: Fetch, group, and render products in batches
     * Shows products as they're ready instead of waiting for everything
     */
    async loadProductsProgressively(filters, grid, clientSideFilterParams = null) {
      const BATCH_SIZE = 250; // Products per API request
      const RENDER_BATCH_SIZE = 50; // Products to render at once
      let cursor = null;
      let hasNextPage = true;
      let pageCount = 0;
      let totalFetched = 0;
      
      // Fetch first batch and render immediately
      while (hasNextPage && totalFetched < 5000) {
        pageCount++;
        this.debugLog(`🟢 Progressive: Fetching batch ${pageCount}...`);
        
        try {
          let data;
          let productsData;
          
          if (this.isSearchMode) {
            // Search mode: use searchProducts() - NO FILTERS for search API
            // Call searchProducts with just query and pagination - no filters
            data = await this.apiClient.searchProducts(
              this.searchTerms,
              null, // cursor
              BATCH_SIZE
            );
            productsData = data.products;
          } else {
            // Collection mode: use getCollection()
            data = await this.apiClient.getCollection(
              this.collectionHandle,
              filters,
              cursor,
              BATCH_SIZE
            );
            productsData = data.collection?.products;
          }
          
          if (!productsData) {
            break;
          }
          
          let pageProducts = productsData.edges.map(edge => edge.node);
          
          // Apply client-side filtering for search mode
          if (clientSideFilterParams && this.isSearchMode) {
            pageProducts = this.applyClientSideFilters(pageProducts, clientSideFilterParams);
            this.debugLog(`🟡 CollectionGroupingEnhancer: Applied client-side filters, ${pageProducts.length} products remaining`);
          }
          
          // Apply relevance scoring and sorting for search mode (prioritize exact artist matches, demote compilations)
          if (this.isSearchMode && this.searchTerms) {
            pageProducts = this.sortByRelevance(pageProducts, this.searchTerms);
            this.debugLog(`🟢 CollectionGroupingEnhancer: Sorted ${pageProducts.length} products by relevance`);
          }
          
          // Store original order
          pageProducts.forEach((product, index) => {
            this.originalProductOrder.set(product.id, totalFetched + index);
          });
          
          // Add to our product map BEFORE grouping (so grouping can find them)
          pageProducts.forEach(product => {
            this.productMap.set(product.id, product);
            this.allProductsMap.set(product.id, product);
          });
          
          this.allFetchedProducts.push(...pageProducts);
          totalFetched += pageProducts.length;
          
          this.debugLog(`🟢 Progressive: Fetched ${pageProducts.length} products (total: ${totalFetched})`);
          
          // Group this batch incrementally
          const newGrouped = this.groupProductsIncremental(pageProducts);
          this.debugLog(`🟢 Progressive: Grouped into ${newGrouped.length} items to render`);
          
          // Render new products
          if (newGrouped.length > 0) {
            const beforeCount = grid.children.length;
            await this.renderProductsBatch(grid, newGrouped, RENDER_BATCH_SIZE);
            const afterCount = grid.children.length;
            
            // Ensure grid is visible after rendering
            grid.classList.remove('js-grouping-hidden');
            if (grid.style.display === 'none') {
              grid.style.display = '';
            }
            this.debugLog(`🟢 Progressive: Rendered ${newGrouped.length} items, grid went from ${beforeCount} to ${afterCount} children`);
            
            if (afterCount === beforeCount) {
              this.debugLog('🔴 Progressive: CRITICAL - Items were not added to grid!');
            }
          } else {
            this.debugLog(`🟡 Progressive: No items to render from batch ${pageCount}`);
          }
          
          // Update pagination
          hasNextPage = productsData.pageInfo.hasNextPage;
          cursor = productsData.pageInfo.endCursor;
          
          // Small delay to prevent overwhelming the browser
          if (hasNextPage) {
            await new Promise(resolve => setTimeout(resolve, 50));
          }
          
        } catch (error) {
          this.debugLog('🔴 Progressive: Error fetching batch:', error.message);
          this.debugLog('🔴 Progressive: Error stack:', error.stack);
          break;
        }
      }
      
      this.debugLog(`🟢 Progressive: Complete! Fetched ${totalFetched} products total`);
    }

    /**
     * Apply client-side filters to products (for search mode where API filters don't work)
     * Applies ALL active filters: productType, styleGenre, mediaCondition, sleeveCondition, price
     */
    applyClientSideFilters(products, filterParams) {
      if (!filterParams) {
        return products; // No filters, return all products
      }
      
      // Check if any filters are active
      const hasFilters = filterParams.productType || filterParams.styleGenre || 
                        filterParams.mediaCondition || filterParams.sleeveCondition ||
                        filterParams.priceMin || filterParams.priceMax;
      
      if (!hasFilters) {
        return products; // No active filters, return all products
      }
      
      this.debugLog(`🔵 CollectionGroupingEnhancer: Applying client-side filters:`, JSON.stringify(filterParams));
      this.debugLog(`🔵 CollectionGroupingEnhancer: Products to filter: ${products.length}`);
      
      // Apply all filters - product must match ALL active filters (AND logic)
      return products.filter(product => {
        let matches = true;
        
        // 1. Product Type filter
        if (filterParams.productType) {
          const filterType = filterParams.productType;
          const filterTypes = Array.isArray(filterType) ? filterType : [filterType];
          const productType = (product.productType || '').toLowerCase();
          
          const typeMatches = filterTypes.some(filter => {
            const filterLower = filter.toLowerCase().trim();
            
            // Handle specific filter mappings
            if (filterLower === 'vinyl lps' || filterLower === 'lp albums') {
              return productType.includes('lp');
            }
            if (filterLower === 'cd albums') {
              return productType.includes('cd');
            }
            if (filterLower === '7" singles') {
              return productType.includes('7');
            }
            if (filterLower === '12" singles') {
              return productType.includes('12');
            }
            if (filterLower === '10" vinyl') {
              return productType.includes('10');
            }
            if (filterLower === 'cassette albums') {
              return productType.includes('cassette');
            }
            // Handle "DVD & Blu-ray" - check for both variations and ampersand encoding
            if (filterLower === 'dvd & blu-ray' || filterLower === 'dvd and blu-ray' || filterLower.includes('dvd') && filterLower.includes('blu')) {
              return productType.includes('dvd') || productType.includes('blu') || productType.includes('blu-ray');
            }
            
            // Fallback to partial match
            return productType.includes(filterLower);
          });
          
          if (!typeMatches) {
            matches = false;
          }
        }
        
        // 2. Style/Genre filter (metafield: computed_style_genre)
        if (filterParams.styleGenre && matches) {
          const filterGenre = filterParams.styleGenre;
          const filterGenres = Array.isArray(filterGenre) ? filterGenre : [filterGenre];
          const productGenre = (product.style_genre?.value || '').toLowerCase().trim();
          
          const genreMatches = filterGenres.some(filter => {
            const filterLower = filter.toLowerCase().trim();
            return productGenre === filterLower || productGenre.includes(filterLower);
          });
          
          if (!genreMatches) {
            matches = false;
          }
        }
        
        // 3. Media Condition filter
        if (filterParams.mediaCondition && matches) {
          const filterCondition = filterParams.mediaCondition;
          const filterConditions = Array.isArray(filterCondition) ? filterCondition : [filterCondition];
          const productCondition = (product.media_condition?.value || '').toLowerCase().trim();
          
          const conditionMatches = filterConditions.some(filter => {
            const filterLower = filter.toLowerCase().trim();
            return productCondition === filterLower || productCondition.includes(filterLower);
          });
          
          if (!conditionMatches) {
            matches = false;
          }
        }
        
        // 4. Sleeve Condition filter
        if (filterParams.sleeveCondition && matches) {
          const filterCondition = filterParams.sleeveCondition;
          const filterConditions = Array.isArray(filterCondition) ? filterCondition : [filterCondition];
          const productCondition = (product.sleeve_condition?.value || '').toLowerCase().trim();
          
          const conditionMatches = filterConditions.some(filter => {
            const filterLower = filter.toLowerCase().trim();
            return productCondition === filterLower || productCondition.includes(filterLower);
          });
          
          if (!conditionMatches) {
            matches = false;
          }
        }
        
        // 5. Price range filter
        if (matches && (filterParams.priceMin || filterParams.priceMax)) {
          const minPrice = product.priceRange?.minVariantPrice?.amount 
            ? parseFloat(product.priceRange.minVariantPrice.amount) 
            : null;
          
          if (minPrice !== null) {
            if (filterParams.priceMin && minPrice < parseFloat(filterParams.priceMin)) {
              matches = false;
            }
            if (filterParams.priceMax && minPrice > parseFloat(filterParams.priceMax)) {
              matches = false;
            }
          }
        }
        
        // Debug first few products
        if (products.indexOf(product) < 3) {
          this.debugLog(`🔵 Filter check: product="${product.title}", matches=${matches}`, {
            productType: product.productType,
            styleGenre: product.style_genre?.value,
            mediaCondition: product.media_condition?.value,
            price: product.priceRange?.minVariantPrice?.amount
          });
        }
        
        return matches;
      });
    }

    /**
     * Sort products by relevance to search terms
     * Mirrors Shopify's native relevance algorithm:
     * - Keyword frequency (how many times term appears)
     * - Field importance (title > vendor > tags > productType)
     * - Field length (shorter fields rank higher)
     * Plus custom music-specific logic (artist matches, compilation penalties)
     */
    sortByRelevance(products, searchTerms) {
      if (!searchTerms || !products || products.length === 0) {
        return products;
      }

      const searchLower = searchTerms.toLowerCase().trim();
      const searchWords = searchLower.split(/\s+/).filter(w => w.length > 0);
      
      // Helper: Count keyword frequency in text
      const countKeywordFrequency = (text, keywords) => {
        if (!text) return 0;
        const textLower = text.toLowerCase();
        return keywords.reduce((count, keyword) => {
          // Count occurrences (case-insensitive)
          const regex = new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
          const matches = textLower.match(regex);
          return count + (matches ? matches.length : 0);
        }, 0);
      };
      
      // Helper: Calculate field length score (shorter = better, like Shopify)
      const getFieldLengthScore = (fieldText, baseScore) => {
        if (!fieldText) return 0;
        const length = fieldText.length;
        // Shorter fields get bonus, longer fields get penalty
        // Formula: baseScore * (1 - (length / 200))
        // This means a 50-char field gets ~75% of baseScore, 200+ char gets ~0%
        const lengthMultiplier = Math.max(0, 1 - (length / 200));
        return baseScore * lengthMultiplier;
      };
      
      // Score each product
      const scoredProducts = products.map(product => {
        let score = 0;
        
        // Get all searchable fields
        const artist = (product.artist?.value || '').toLowerCase().trim();
        const title = (product.title || '').toLowerCase();
        const vendor = (product.vendor || '').toLowerCase();
        const tags = (product.tags || []).map(t => t.toLowerCase()).join(' ');
        const productType = (product.productType || '').toLowerCase();
        
        // === SHOPIFY'S NATIVE RELEVANCE FACTORS ===
        
        // 1. KEYWORD FREQUENCY with FIELD IMPORTANCE
        // Title (highest weight) - Shopify prioritizes title matches
        const titleFreq = countKeywordFrequency(title, searchWords);
        if (titleFreq > 0) {
          // Exact phrase match in title gets highest score
          if (title.includes(searchLower)) {
            score += 1000 * (1 + titleFreq * 0.5); // Base 1000 + frequency bonus
          } else if (searchWords.every(word => title.includes(word))) {
            // All words present
            score += 800 * (1 + titleFreq * 0.3);
          } else {
            // Some words present
            score += 400 * (1 + titleFreq * 0.2);
          }
          // Field length bonus (shorter titles rank higher)
          score += getFieldLengthScore(title, 200);
        }
        
        // Vendor (medium-high weight)
        const vendorFreq = countKeywordFrequency(vendor, searchWords);
        if (vendorFreq > 0) {
          if (vendor.includes(searchLower)) {
            score += 500 * (1 + vendorFreq * 0.3);
          } else if (searchWords.every(word => vendor.includes(word))) {
            score += 300 * (1 + vendorFreq * 0.2);
          } else {
            score += 150 * (1 + vendorFreq * 0.1);
          }
          score += getFieldLengthScore(vendor, 100);
        }
        
        // Tags (medium weight)
        const tagsFreq = countKeywordFrequency(tags, searchWords);
        if (tagsFreq > 0) {
          if (tags.includes(searchLower)) {
            score += 300 * (1 + tagsFreq * 0.2);
          } else if (searchWords.some(word => tags.includes(word))) {
            score += 150 * (1 + tagsFreq * 0.1);
          }
          score += getFieldLengthScore(tags, 50);
        }
        
        // ProductType (lower weight)
        const productTypeFreq = countKeywordFrequency(productType, searchWords);
        if (productTypeFreq > 0) {
          if (productType.includes(searchLower)) {
            score += 200 * (1 + productTypeFreq * 0.2);
          } else if (searchWords.some(word => productType.includes(word))) {
            score += 100 * (1 + productTypeFreq * 0.1);
          }
          score += getFieldLengthScore(productType, 30);
        }
        
        // === CUSTOM MUSIC-SPECIFIC LOGIC (Additional Layer) ===
        
        // Artist metafield match (music-specific, very high priority)
        if (artist) {
          if (artist === searchLower) {
            score += 1500; // Exact artist match (highest priority for music)
          } else if (artist.includes(searchLower)) {
            score += 800; // Partial artist match
          } else if (searchWords.length > 0 && searchWords.every(word => artist.includes(word))) {
            score += 600; // All search words in artist
          } else if (searchWords.some(word => artist.includes(word))) {
            score += 300; // Some search words in artist
          }
        }
        
        // Penalty: Compilations ("Various" artist) should rank lower
        if (artist === 'various' || artist.startsWith('various ')) {
          score -= 400; // Heavy penalty for compilations
        }
        
        // Small penalty: Products with no artist metafield (less reliable for music)
        if (!artist || artist === '') {
          score -= 30;
        }
        
        return { product, score };
      });
      
      // Sort by score (descending), then by title for tie-breaking
      scoredProducts.sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score; // Higher score first
        }
        // Tie-breaker: alphabetical by title
        const titleA = (a.product.title || '').toLowerCase();
        const titleB = (b.product.title || '').toLowerCase();
        return titleA.localeCompare(titleB);
      });
      
      // Log top 5 for debugging
      if (scoredProducts.length > 0) {
        const top5 = scoredProducts.slice(0, 5).map(({ product, score }) => ({
          title: product.title,
          artist: product.artist?.value || 'N/A',
          vendor: product.vendor || 'N/A',
          score: Math.round(score)
        }));
        this.debugLog(`🔵 Shopify-style relevance scoring - Top 5:`, top5);
      }
      
      return scoredProducts.map(({ product }) => product);
    }
    
    /**
     * Groups products incrementally, handling merging with existing groups
     */
    groupProductsIncremental(newProducts) {
      const getFormat = (productType) => {
        if (!productType) return '';
        const type = productType.trim();
        const typeLower = type.toLowerCase();
        if (typeLower.includes('12')) return '12"';
        if (typeLower.includes('10')) return '10"';
        if (typeLower.includes('7')) return '7"';
        if (typeLower.includes('box')) {
          if (typeLower.includes('lp') || typeLower.includes('vinyl')) return 'LP Box';
          if (typeLower.includes('cd')) return 'CD Box';
          return 'Box Set';
        }
        if (typeLower.includes('lp')) return 'LP';
        if (typeLower.includes('cd')) return 'CD';
        if (typeLower.includes('cassette')) return 'Cassette';
        if (typeLower.includes('ep')) return 'EP';
        if (typeLower.includes('dvd')) return 'DVD';
        if (typeLower.includes('blu')) return 'Blu-ray';
        if (typeLower.includes('vhs')) return 'VHS';
        return '';
      };
      
      const itemsToRender = [];
      const processedIds = new Set();
      
      // Process new products
      let skippedCount = 0;
      for (const product of newProducts) {
        // If product is already rendered (as part of a group or individually), skip it
        if (this.renderedProductIds.has(product.id)) {
          skippedCount++;
          continue; // Already rendered - don't render again
        }
        
        const artist = (product.artist && product.artist.value) ? product.artist.value.trim() : '';
        const album = (product.title_metafield && product.title_metafield.value) ? product.title_metafield.value.trim() : '';
        const format = getFormat(product.productType);
        
        if (!artist || !album) {
          // Single product without grouping info
          itemsToRender.push({ type: 'single', product, originalIndex: this.originalProductOrder.get(product.id) ?? Infinity });
          this.renderedProductIds.add(product.id);
          processedIds.add(product.id);
          continue;
        }
        
        // Check for existing group
        const groupKey = `${artist.toLowerCase()}|${album.toLowerCase()}|${format}`;
        let existingGroup = this.groupMap.get(groupKey);
        
        // Check if group was already rendered BEFORE adding product to it
        const groupAlreadyRendered = existingGroup && this.renderedProductIds.has(existingGroup.mainProduct.id);
        
        if (!existingGroup) {
          // Check if any products in this group already exist (including current product)
          const matchingProducts = [];
          
          // Always include current product first
          matchingProducts.push(product);
          
          // Then check for other matching products in productMap
          for (const [id, p] of this.productMap.entries()) {
            // Skip if already rendered or if it's the current product
            if (this.renderedProductIds.has(id) || id === product.id) continue;
            const pArtist = (p.artist && p.artist.value) ? p.artist.value.trim() : '';
            const pAlbum = (p.title_metafield && p.title_metafield.value) ? p.title_metafield.value.trim() : '';
            const pFormat = getFormat(p.productType);
            if (pArtist.toLowerCase() === artist.toLowerCase() && 
                pAlbum.toLowerCase() === album.toLowerCase() && 
                pFormat === format) {
              matchingProducts.push(p);
            }
          }
          
          if (matchingProducts.length > 1) {
            // Create new group
            existingGroup = {
              type: 'group',
              mainProduct: matchingProducts[0],
              variantProducts: matchingProducts.slice(1),
              format: format,
              allProducts: matchingProducts
            };
            this.groupMap.set(groupKey, existingGroup);
          }
        } else {
          // Add to existing group
          if (!existingGroup.allProducts.find(p => p.id === product.id)) {
            existingGroup.allProducts.push(product);
            if (existingGroup.mainProduct.id !== product.id) {
              existingGroup.variantProducts.push(product);
            }
          }
        }
        
        // If group was already rendered, skip this product (it's already in the rendered group)
        if (groupAlreadyRendered) {
          // Product matches an already-rendered group - skip it (already rendered as part of group)
          this.renderedProductIds.add(product.id);
          processedIds.add(product.id);
          skippedCount++;
        } else if (existingGroup && existingGroup.allProducts.length > 1) {
          // Render group if ready (only if we have 2+ products and not already rendered)
          // CRITICAL: Only mark products as rendered that are actually in this batch being processed
          const productsInThisBatch = existingGroup.allProducts.filter(p => 
            newProducts.some(np => np.id === p.id)
          );
          
          // Only render if at least one product from this batch is in the group
          if (productsInThisBatch.length > 0) {
            const variantHandles = existingGroup.variantProducts.map(p => p.handle).join(',');
            itemsToRender.push({
              type: 'group',
              group: {
                mainProduct: existingGroup.mainProduct,
                variantProducts: existingGroup.variantProducts,
                format: existingGroup.format
              },
              variantHandles,
              variantProducts: existingGroup.variantProducts,
              product: existingGroup.mainProduct,
              originalIndex: this.originalProductOrder.get(existingGroup.mainProduct.id) ?? Infinity
            });
            
            // Mark only products from this batch as rendered (not all products in group)
            productsInThisBatch.forEach(p => {
              this.renderedProductIds.add(p.id);
              processedIds.add(p.id);
            });
            // Also mark main product if it's in this batch
            if (productsInThisBatch.some(p => p.id === existingGroup.mainProduct.id)) {
              this.renderedProductIds.add(existingGroup.mainProduct.id);
            }
          }
        } else {
          // Single product (no group, or group with only 1 product)
          itemsToRender.push({ 
            type: 'single', 
            product, 
            originalIndex: this.originalProductOrder.get(product.id) ?? Infinity 
          });
          this.renderedProductIds.add(product.id);
          processedIds.add(product.id);
        }
      }
      
      // Sort by original order
      itemsToRender.sort((a, b) => a.originalIndex - b.originalIndex);
      
      if (newProducts.length > 0 && itemsToRender.length === 0) {
        this.debugLog(`🔴 CRITICAL: Processed ${newProducts.length} products but 0 items to render! Skipped ${skippedCount} already rendered.`);
      }
      
      return itemsToRender;
    }
    
    /**
     * Render a batch of products progressively
     */
    async renderProductsBatch(grid, items, batchSize) {
      this.debugLog(`🟢 renderProductsBatch: Starting with ${items.length} items, batchSize: ${batchSize}, grid:`, grid);
      const batches = [];
      for (let i = 0; i < items.length; i += batchSize) {
        batches.push(items.slice(i, i + batchSize));
      }
      
      this.debugLog(`🟢 renderProductsBatch: Split into ${batches.length} batches`);
      
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        const fragment = document.createDocumentFragment();
        let cardsAdded = 0;
        
        this.debugLog(`🟢 renderProductsBatch: Processing batch ${batchIndex + 1}/${batches.length} with ${batch.length} items`);
        
        for (const item of batch) {
          try {
            const cardElement = await this.fetchCard(item);
            if (cardElement && cardElement.cardElement) {
              fragment.appendChild(cardElement.cardElement);
              cardsAdded++;
            } else {
              this.debugLog(`🔴 renderProductsBatch: fetchCard returned no cardElement for item:`, item);
            }
          } catch (error) {
            this.debugLog('🔴 renderProductsBatch: Error rendering card:', error.message);
            this.debugLog('🔴 renderProductsBatch: Error stack:', error.stack);
          }
        }
        
        this.debugLog(`🟢 renderProductsBatch: Batch ${batchIndex + 1} - created ${cardsAdded} cards in fragment, grid currently has ${grid.children.length} children`);
        
        // Append batch to grid
        const beforeAppend = grid.children.length;
        grid.appendChild(fragment);
        const afterAppend = grid.children.length;
        
        this.debugLog(`🟢 renderProductsBatch: After append - grid went from ${beforeAppend} to ${afterAppend} children (added ${afterAppend - beforeAppend})`);
        
        if (afterAppend === beforeAppend && cardsAdded > 0) {
          this.debugLog('🔴 renderProductsBatch: CRITICAL - Fragment had cards but grid children count did not increase!');
          this.debugLog('🔴 renderProductsBatch: Grid element:', grid);
          this.debugLog('🔴 renderProductsBatch: Fragment children:', fragment.children.length);
        }
        
        // Small delay between batches for smooth rendering
        if (batches.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
      
      this.debugLog(`🟢 renderProductsBatch: Complete! Grid now has ${grid.children.length} total children`);
    }
    
    /**
     * Fetches ALL products from a collection via Storefront API
     * Handles pagination automatically (250 products per page, up to 5,000 total)
     * 
     * @returns {Promise<Array>} - Array of all products in the collection
     */
    async fetchAllProducts(filters = []) {
      const mode = this.isSearchMode ? 'search' : 'collection';
      const identifier = this.isSearchMode ? this.searchTerms : this.collectionHandle;
      window.themeLogger?.log(`🟢 CollectionGroupingEnhancer: fetchAllProducts() called for ${mode}:`, identifier, 'with filters:', filters);
      
      // This method may not be used anymore (replaced by loadProductsProgressively)
      // But if it is, it needs to support search mode
      if (this.isSearchMode) {
        window.themeLogger?.warn('🟡 CollectionGroupingEnhancer: fetchAllProducts() called in search mode - consider using loadProductsProgressively() instead');
      }
      const allProducts = [];
      let cursor = null;
      let hasNextPage = true;
      const limit = 250; // Max per request
      let pageCount = 0;

      while (hasNextPage && allProducts.length < 5000) { // Safety limit
        pageCount++;
        window.themeLogger?.log(`🟢 CollectionGroupingEnhancer: Fetching page ${pageCount}, cursor:`, cursor ? 'exists' : 'null');
        
        try {
          const data = await this.apiClient.getCollection(
            this.collectionHandle,
            filters, // Use provided filters
            cursor,
            limit
          );

          window.themeLogger?.log('🟢 CollectionGroupingEnhancer: API response received:', {
            hasCollection: !!data.collection,
            hasProducts: !!(data.collection && data.collection.products),
            edgesCount: data.collection?.products?.edges?.length || 0
          });

          if (!data.collection || !data.collection.products) {
            window.themeLogger?.log('🟢 CollectionGroupingEnhancer: No collection or products in response, breaking');
            break;
          }

          // Add products from this page
          const pageProducts = data.collection.products.edges.map(edge => edge.node);
          allProducts.push(...pageProducts);
          window.themeLogger?.log(`🟢 CollectionGroupingEnhancer: Added ${pageProducts.length} products from page ${pageCount}, total: ${allProducts.length}`);

          // Check if there are more pages
          hasNextPage = data.collection.products.pageInfo.hasNextPage;
          cursor = data.collection.products.pageInfo.endCursor;
          window.themeLogger?.log('🟢 CollectionGroupingEnhancer: Has next page:', hasNextPage);
        } catch (error) {
          window.themeLogger?.error('🔴 CollectionGroupingEnhancer: Error fetching products:', error);
          window.themeLogger?.error('🔴 CollectionGroupingEnhancer: Error stack:', error.stack);
          break;
        }
      }

      window.themeLogger?.log('🟢 CollectionGroupingEnhancer: fetchAllProducts() complete, total products:', allProducts.length);
      return allProducts;
    }

    /**
     * Groups products by artist + album + format
     * 
     * GROUPING LOGIC:
     * - Products are grouped if they have the same artist, album, and format
     * - Artist and album are normalized (lowercase, trimmed) for case-insensitive matching
     * - Format is extracted from productType using the same logic as Liquid
     * - Products without artist/album are added to singles
     * 
     * @param {Array} products - Array of product objects from Storefront API
     * @returns {Object} - { groups: Array, singles: Array }
     */
    groupAllProducts(products) {
      window.themeLogger?.log('🟡 CollectionGroupingEnhancer: groupAllProducts() called with', products.length, 'products');
      const singleProducts = [];

      // Extract format from productType - MUST match Liquid logic exactly
      // Liquid checks in this order: 12, 10, 7, Box, LP, CD, Cassette, EP, DVD, Blu, VHS
      const getFormat = (productType) => {
        if (!productType) return '';
        const type = productType.trim(); // Keep original case for Box check
        const typeLower = type.toLowerCase();
        
        // Check in exact order as Liquid (order matters!)
        if (typeLower.includes('12')) return '12"';
        if (typeLower.includes('10')) return '10"';
        if (typeLower.includes('7')) return '7"';
        // Box checks must come before LP/CD checks
        if (typeLower.includes('box')) {
          if (typeLower.includes('lp') || typeLower.includes('vinyl')) return 'LP Box';
          if (typeLower.includes('cd')) return 'CD Box';
          return 'Box Set';
        }
        if (typeLower.includes('lp')) return 'LP';
        if (typeLower.includes('cd')) return 'CD';
        if (typeLower.includes('cassette')) return 'Cassette';
        if (typeLower.includes('ep')) return 'EP';
        if (typeLower.includes('dvd')) return 'DVD';
        if (typeLower.includes('blu')) return 'Blu-ray';
        if (typeLower.includes('vhs')) return 'VHS';
        return '';
      };

      // First pass: Group products
      // Build a map of group keys to products
      const groupMap = new Map(); // key: "artist|album|format", value: Set of product IDs
      const productMap = new Map(); // key: product ID, value: product object
      
      // First, index all products by ID and build group keys
      for (const product of products) {
        productMap.set(product.id, product);
        
        // Normalize artist and album - trim and lowercase for comparison
        const artist = (product.artist && product.artist.value) ? product.artist.value.trim() : '';
        const album = (product.title_metafield && product.title_metafield.value) ? product.title_metafield.value.trim() : '';
        const format = getFormat(product.productType);
        
        if (!artist || !album) {
          // Can't group without artist/album - will be added to singles later
          continue;
        }
        
        // Create normalized group key (case-insensitive, trimmed)
        const groupKey = `${artist.toLowerCase()}|${album.toLowerCase()}|${format}`;
        
        if (!groupMap.has(groupKey)) {
          groupMap.set(groupKey, new Set());
        }
        
        groupMap.get(groupKey).add(product.id);
      }
      
      // Now build groups from the map
      const usedProductIds = new Set();
      const groupedArray = [];
      
      for (const [groupKey, productIdSet] of groupMap.entries()) {
        const productIds = Array.from(productIdSet);
        
        // Filter out already used products
        const uniqueProductIds = productIds.filter(id => !usedProductIds.has(id));
        
        if (uniqueProductIds.length > 1) {
          // Multiple products - create group
          const groupProducts = uniqueProductIds.map(id => productMap.get(id)).filter(Boolean);
          
          groupedArray.push({
            type: 'group',
            mainProduct: groupProducts[0],
            variantProducts: groupProducts.slice(1),
            format: groupKey.split('|')[2]
          });
          
          // Mark all products as used
          uniqueProductIds.forEach(id => usedProductIds.add(id));
          
        } else if (uniqueProductIds.length === 1) {
          // Single product - add to singles if not already used
          const productId = uniqueProductIds[0];
          if (!usedProductIds.has(productId)) {
            singleProducts.push(productMap.get(productId));
            usedProductIds.add(productId);
          }
        }
      }
      
      // Add any products without artist/album to singles
      for (const product of products) {
        if (!usedProductIds.has(product.id)) {
          const artist = (product.artist && product.artist.value) ? product.artist.value : '';
          const album = (product.title_metafield && product.title_metafield.value) ? product.title_metafield.value : '';
          
          if (!artist || !album) {
            singleProducts.push(product);
            usedProductIds.add(product.id);
          }
        }
      }

      window.themeLogger?.log('🟡 CollectionGroupingEnhancer: groupAllProducts() complete:', {
        totalGroups: groupedArray.length,
        totalSingles: singleProducts.length,
        totalProcessed: usedProductIds.size
      });

      return {
        groups: groupedArray,
        singles: singleProducts
      };
    }

    /**
     * Renders grouped products using Section Rendering API
     * 
     * PROCESS:
     * 1. Test Section Rendering API accessibility (try both endpoint formats)
     * 2. Build fetch URLs for all groups and singles
     * 3. Fetch all cards in parallel using Promise.allSettled
     * 4. Extract card HTML from responses (handles section wrapper)
     * 5. Insert cards into DOM
     * 6. Track metrics (success rate, render time, etc.)
     * 
     * @param {Object} groupedData - { groups: Array, singles: Array }
     */
    async renderGroupedProducts(groupedData) {
      const renderStartTime = Date.now();
      const existingGrid = document.querySelector('.main-products-grid__results ul, .main-products-grid__results .products-grid-container ul');
      if (!existingGrid) {
        window.themeLogger?.error('🔴 CollectionGroupingEnhancer: Could not find product grid');
        throw new Error('Product grid not found');
      }

      window.themeLogger?.log('🟣 CollectionGroupingEnhancer: Rendering', groupedData.groups.length, 'groups and', groupedData.singles.length, 'singles');
      
      // Store original grid classes and attributes to preserve them
      const originalGridClasses = existingGrid.className;
      const originalGridAttributes = {};
      Array.from(existingGrid.attributes).forEach(attr => {
        originalGridAttributes[attr.name] = attr.value;
      });
      
      window.themeLogger?.log('🟣 CollectionGroupingEnhancer: Original grid classes:', originalGridClasses);
      window.themeLogger?.log('🟣 CollectionGroupingEnhancer: Original grid attributes:', originalGridAttributes);
      
      // Clear grid content but preserve the grid element structure
      existingGrid.innerHTML = '';
      
      // Restore original classes and attributes (in case innerHTML cleared them)
      existingGrid.className = originalGridClasses;
      Object.keys(originalGridAttributes).forEach(attrName => {
        existingGrid.setAttribute(attrName, originalGridAttributes[attrName]);
      });

      // Get settings from the page (same as Liquid would use)
      this.enableCompare = document.querySelector('[data-compare]')?.dataset.compare === 'true' || false;
      
      // Get card_size from the element's data attribute (set by collection page)
      this.cardSize = this.cardSize || 'medium';
      
      // Store all products map for price calculation
      this.allProductsMap = new Map();
      for (const group of groupedData.groups) {
        this.allProductsMap.set(group.mainProduct.id, group.mainProduct);
        for (const variant of group.variantProducts) {
          this.allProductsMap.set(variant.id, variant);
        }
      }
      for (const product of groupedData.singles) {
        this.allProductsMap.set(product.id, product);
      }

      // Build all fetch items for rendering
      // CRITICAL: Preserve original product order by merging groups and singles
      // and sorting by the original position of the main product
      const allItems = [];
      
      // Add groups with their original position (use first product in group's position)
      for (const group of groupedData.groups) {
        const variantHandles = group.variantProducts.map(p => p.handle).join(',');
        // Find original position of main product
        const originalIndex = this.originalProductOrder.get(group.mainProduct.id) ?? Infinity;
        allItems.push({ 
          type: 'group', 
          group, 
          variantHandles,
          variantProducts: group.variantProducts,
          product: group.mainProduct,
          originalIndex
        });
      }
      
      // Add singles with their original position
      for (const product of groupedData.singles) {
        const originalIndex = this.originalProductOrder.get(product.id) ?? Infinity;
        allItems.push({ 
          type: 'single', 
          product,
          originalIndex
        });
      }
      
      // Sort by original position to preserve collection order
      allItems.sort((a, b) => a.originalIndex - b.originalIndex);
      
      const fetchPromises = allItems;

      window.themeLogger?.log('🟣 CollectionGroupingEnhancer: Implementing virtual scrolling with progressive rendering');
      window.themeLogger?.log('🟣 CollectionGroupingEnhancer: Total cards to render:', fetchPromises.length);
      
      // VIRTUAL SCROLLING + PROGRESSIVE RENDERING STRATEGY:
      // 1. Render first batch immediately (instant page load)
      // 2. Store remaining cards in memory (don't fetch until needed)
      // 3. Use IntersectionObserver to detect scroll near bottom
      // 4. Load next batch as user scrolls
      // 
      // This means:
      // - Initial load: ~2 seconds (50-100 cards)
      // - User sees content immediately
      // - Remaining cards load on-demand as they scroll
      
      const INITIAL_BATCH_SIZE = 50; // Cards to render immediately
      const SCROLL_BATCH_SIZE = 30; // Cards to load when scrolling
      const BATCH_FETCH_SIZE = 20; // Concurrent API requests per batch
      
      // Store all fetch promises for lazy loading
      this.allFetchPromises = fetchPromises;
      this.renderedCount = 0;
      this.isLoading = false;
      
      // Grid is already cleared above, just ensure js-grouping-hidden is removed
      // This class was added by Liquid to hide initial products, but we need to show our JS-rendered cards
      existingGrid.classList.remove('js-grouping-hidden');
      
      // Render initial batch immediately (progressive rendering)
      await this.renderBatch(existingGrid, 0, INITIAL_BATCH_SIZE, BATCH_FETCH_SIZE);
      
      // Set up virtual scrolling (load more as user scrolls)
      if (this.renderedCount < fetchPromises.length) {
        this.setupVirtualScrolling(existingGrid, BATCH_FETCH_SIZE, SCROLL_BATCH_SIZE);
      }
      
      // Verify grid has cards
      const gridChildren = existingGrid.children.length;
      window.themeLogger?.log('🟣 CollectionGroupingEnhancer: Initial batch complete');
      window.themeLogger?.log('🟣 CollectionGroupingEnhancer: Rendered count:', this.renderedCount);
      window.themeLogger?.log('🟣 CollectionGroupingEnhancer: Grid children count:', gridChildren);
      window.themeLogger?.log('🟣 CollectionGroupingEnhancer: Grid visible?', existingGrid.offsetParent !== null);
      window.themeLogger?.log('🟣 CollectionGroupingEnhancer: Grid display:', window.getComputedStyle(existingGrid).display);
      
      if (gridChildren === 0 && this.renderedCount > 0) {
        window.themeLogger?.error('🔴 CollectionGroupingEnhancer: CRITICAL - Cards were counted but not added to grid!');
        window.themeLogger?.error('🔴 CollectionGroupingEnhancer: Grid selector might be wrong or grid was cleared');
      }
      
      window.themeLogger?.log('🟣 CollectionGroupingEnhancer: Virtual scrolling active - remaining cards will load on scroll');
      
      // Reinitialize components after initial render
      this.reinitializeComponents();
    }


    
    formatPrice(priceObj) {
      if (!priceObj) return '';
      const amount = parseFloat(priceObj.amount || 0);
      const currency = priceObj.currencyCode || 'GBP';
      return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency }).format(amount);
    }

    /**
     * Renders a batch of cards (progressive rendering)
     * @param {HTMLElement} grid - The grid element to append cards to
     * @param {number} startIndex - Starting index in fetchPromises array
     * @param {number} count - Number of cards to render
     * @param {number} batchFetchSize - Number of concurrent API requests
     */
    async renderBatch(grid, startIndex, count, batchFetchSize) {
      if (this.isLoading) return;
      this.isLoading = true;
      
      const endIndex = Math.min(startIndex + count, this.allFetchPromises.length);
      const batch = this.allFetchPromises.slice(startIndex, endIndex);
      
      this.debugLog(`🟣 CollectionGroupingEnhancer: Rendering batch ${startIndex}-${endIndex} (${batch.length} cards)...`);
      
      // Fetch cards in smaller sub-batches to avoid overwhelming browser
      const results = [];
      for (let i = 0; i < batch.length; i += batchFetchSize) {
        const subBatch = batch.slice(i, i + batchFetchSize);
        const subBatchResults = await Promise.allSettled(
          subBatch.map(item => this.fetchCard(item))
        );
        
        // Render ONLY the new sub-batch results (not all results to avoid duplicates)
        this.renderResults(grid, subBatchResults, startIndex + i);
        
        // Store results for potential future use
        results.push(...subBatchResults);
      }
      
      this.isLoading = false;
    }
    
    /**
     * Renders a card client-side using Storefront API data
     * This works for ALL products (no Liquid limits) by using data we already have
     * SAME as collections - uses renderCardFromData for consistent rendering
     */
    async fetchCard(item) {
      try {
        const product = item.type === 'group' ? (item.group?.mainProduct || item.product) : item.product;
        const isGroup = item.type === 'group';
        const variantHandles = isGroup ? (item.variantHandles || '') : '';
        const groupSize = isGroup ? (item.variantHandles ? item.variantHandles.split(',').filter(h => h).length : (item.group?.variantProducts?.length || 0)) : 0;
        const groupFormat = isGroup ? (item.group?.format || '') : '';
        const variantProducts = isGroup ? (item.variantProducts || item.group?.variantProducts || []) : [];
        
        // Render card using Storefront API data - EXACTLY the same as collections
        const cardElement = this.renderCardFromData(product, {
          isGroup,
          groupSize,
          variantHandles,
          groupFormat,
          variantProducts,
          enableCompare: this.enableCompare,
          cardSize: this.cardSize,
          collectionHandle: this.collectionHandle
        });
        
        if (!cardElement) {
          this.debugLog(`🔴 fetchCard: renderCardFromData returned null/undefined for product:`, product.handle);
          return null;
        }
        
        if (!cardElement.nodeName) {
          this.debugLog(`🔴 fetchCard: cardElement is not a DOM element:`, typeof cardElement);
          return null;
        }
        
        this.debugLog(`🟢 fetchCard: Successfully created card element (${cardElement.nodeName}) for product:`, product.handle);
        
        return { ...item, cardElement };
      } catch (error) {
        this.debugLog(`🔴 fetchCard: Error rendering card:`, error.message);
        this.debugLog(`🔴 fetchCard: Error stack:`, error.stack);
        throw error;
      }
    }
    
    /**
     * Renders a product card from Storefront API data
     * Matches Liquid product-group-card structure exactly
     */
    renderCardFromData(product, options = {}) {
      const {
        isGroup = false,
        groupSize = 0,
        variantHandles = '',
        groupFormat = '',
        variantProducts = [],
        enableCompare = false,
        cardSize = 'medium',
        collectionHandle = ''
      } = options;
      
      const li = document.createElement('li');
      li.className = 'js-pagination-result';
      
      // Build product URL
      const productUrl = collectionHandle 
        ? `/collections/${collectionHandle}/products/${product.handle}`
        : `/products/${product.handle}`;
      
      // Calculate lowest price for grouped products
      let lowestPrice = parseFloat(product.priceRange?.minVariantPrice?.amount || 0);
      let showFromPrice = false;
      if (isGroup && variantProducts.length > 0) {
        showFromPrice = true;
        for (const variantProduct of variantProducts) {
          const variantPrice = parseFloat(variantProduct.priceRange?.minVariantPrice?.amount || 0);
          if (variantPrice > 0 && variantPrice < lowestPrice) {
            lowestPrice = variantPrice;
          }
        }
      }
      
      // Get price
      const price = showFromPrice ? lowestPrice : parseFloat(product.priceRange?.minVariantPrice?.amount || 0);
      const currency = product.priceRange?.minVariantPrice?.currencyCode || 'GBP';
      const comparePrice = product.compareAtPriceRange?.minVariantPrice?.amount 
        ? parseFloat(product.compareAtPriceRange.minVariantPrice.amount) 
        : null;
      const isOnSale = comparePrice && comparePrice > price;
      
      // Get image
      const imageUrl = product.featuredImage?.url || '';
      const imageAlt = product.featuredImage?.altText || product.title;
      
      // Extract artist and title from metafields or parse from product title
      let artist = (product.artist && product.artist.value) ? product.artist.value.trim() : '';
      let albumTitle = (product.title_metafield && product.title_metafield.value) ? product.title_metafield.value.trim() : '';
      
      // If metafields are empty, try parsing from product title
      if (!artist || !albumTitle) {
        const titleParts = (product.title || '').split(' - ');
        if (titleParts.length >= 2) {
          artist = titleParts[0].trim();
          albumTitle = titleParts[1].trim();
        } else {
          artist = product.vendor || '';
          albumTitle = product.title || '';
        }
      }
      
      // Get vendor/artist for display (used in card template)
      const vendor = artist || product.vendor || '';
      
      // Build base title: "artist - title"
      let baseTitle = '';
      if (artist && albumTitle) {
        baseTitle = `${artist} - ${albumTitle}`;
      } else if (albumTitle) {
        baseTitle = albumTitle;
      } else {
        baseTitle = product.title || '';
      }
      
      // Remove ALL format patterns from base title (comprehensive list including "7" not just "7"")
      let cleanTitle = baseTitle;
      
      // Remove format patterns with dash (e.g., " - (LP)", " - (7")", " - (7)")
      const formatPatternsWithDash = [
        / - \(LP\)/gi, / - \(CD\)/gi, / - \(7"\)/gi, / - \(7\)/gi, / - \(12"\)/gi, / - \(12\)/gi, / - \(10"\)/gi, / - \(10\)/gi,
        / - \(EP\)/gi, / - \(DVD\)/gi, / - \(Blu-ray\)/gi, / - \(Cassette\)/gi, / - \(VHS\)/gi,
        / - \(2xLP\)/gi, / - \(2xCD\)/gi, / - \(3xLP\)/gi, / - \(3xCD\)/gi, / - \(2xCassette\)/gi,
        / - \(LP Box\)/gi, / - \(CD Box\)/gi, / - \(Box Set\)/gi, / - \(Vinyl Box Set\)/gi, / - \(CD Box Set\)/gi
      ];
      
      // Remove format patterns without dash (e.g., "(LP)", "(7")", "(7)")
      const formatPatternsWithoutDash = [
        / \(LP\)/gi, / \(CD\)/gi, / \(7"\)/gi, / \(7\)/gi, / \(12"\)/gi, / \(12\)/gi, / \(10"\)/gi, / \(10\)/gi,
        / \(EP\)/gi, / \(DVD\)/gi, / \(Blu-ray\)/gi, / \(Cassette\)/gi, / \(VHS\)/gi,
        / \(2xLP\)/gi, / \(2xCD\)/gi, / \(3xLP\)/gi, / \(3xCD\)/gi, / \(2xCassette\)/gi,
        / \(LP Box\)/gi, / \(CD Box\)/gi, / \(Box Set\)/gi, / \(Vinyl Box Set\)/gi, / \(CD Box Set\)/gi
      ];
      
      formatPatternsWithDash.forEach(pattern => {
        cleanTitle = cleanTitle.replace(pattern, '');
      });
      
      formatPatternsWithoutDash.forEach(pattern => {
        cleanTitle = cleanTitle.replace(pattern, '');
      });
      
      // Remove ALL grading/condition patterns
      const conditionPatterns = [
        /\s*\(Near Mint \(NM or M-\)\)/gi,
        /\s*\(Near Mint \(NM Or M-\)\)/gi,
        /\s*\(Very Good Plus \(VG\+\)\)/gi,
        /\s*\(Very Good Plus \(VG\)\)/gi,
        /\s*\(Very Good \(VG\+\)\)/gi,
        /\s*\(Very Good \(VG\)\)/gi,
        /\s*\(Good Plus \(G\+\)\)/gi,
        /\s*\(Good Plus \(G\)\)/gi,
        /\s*\(Good \(G\+\)\)/gi,
        /\s*\(Good \(G\)\)/gi,
        /\s*\(Fair \(F\)\)/gi,
        /\s*\(Poor \(P\)\)/gi,
        /\s*\(Mint \(M\)\)/gi,
        /\s*\([^)]*[NM|VG|G|F|P|M][^)]*\)/gi // Generic condition pattern
      ];
      
      conditionPatterns.forEach(pattern => {
        cleanTitle = cleanTitle.replace(pattern, '');
      });
      
      // Clean up double spaces and trim
      cleanTitle = cleanTitle.replace(/\s{2,}/g, ' ').trim();
      
      // Extract format from product type for display (just the format, not full product type)
      const getFormat = (productType) => {
        if (!productType) return '';
        const type = productType.trim();
        const typeLower = type.toLowerCase();
        
        // Check in exact order (order matters!)
        if (typeLower.includes('12')) return '12"';
        if (typeLower.includes('10')) return '10"';
        if (typeLower.includes('7')) return '7"';
        if (typeLower.includes('box')) {
          if (typeLower.includes('lp') || typeLower.includes('vinyl')) return 'LP Box';
          if (typeLower.includes('cd')) return 'CD Box';
          return 'Box Set';
        }
        if (typeLower.includes('lp')) return 'LP';
        if (typeLower.includes('cd')) return 'CD';
        if (typeLower.includes('cassette')) return 'Cassette';
        if (typeLower.includes('ep')) return 'EP';
        if (typeLower.includes('dvd')) return 'DVD';
        if (typeLower.includes('blu')) return 'Blu-ray';
        if (typeLower.includes('vhs')) return 'VHS';
        return '';
      };
      
      const displayFormat = getFormat(product.productType || product.type || '');
      
      // Get condition for single products only
      let gradeCondition = '';
      if (!isGroup && product.media_condition?.value) {
        const mediaAbbr = product.media_condition.value;
        const conditionMap = {
          'M': 'Mint (M)',
          'NM': 'Near Mint (NM or M-)',
          'M-': 'Near Mint (NM or M-)',
          'NM or M-': 'Near Mint (NM or M-)',
          'VG+': 'Very Good Plus (VG+)',
          'VG': 'Very Good (VG)',
          'G+': 'Good Plus (G+)',
          'Good Plus': 'Good Plus (G+)',
          'G': 'Good (G)',
          'Good': 'Good (G)',
          'F': 'Fair (F)',
          'Fair': 'Fair (F)',
          'P': 'Poor (P)',
          'Poor': 'Poor (P)'
        };
        gradeCondition = conditionMap[mediaAbbr] || '';
      }
      
      // Build "from" text for grouped products
      let fromText = 'from';
      if (isGroup && groupFormat) {
        const formatArray = groupFormat.split(',');
        if (formatArray.length > 1) {
          fromText = 'various formats from';
        } else {
          fromText = 'various from';
        }
      }
      
      // Check if product has only default variant
      const hasOnlyDefaultVariant = product.variants?.edges?.length === 1;
      const firstVariant = product.variants?.edges?.[0]?.node;
      
      // Check if product is not for sale (coming-soon, countdown templates)
      // Note: Storefront API doesn't return templateSuffix, so we'll show buttons for all products
      // This matches Liquid behavior where buttons show unless explicitly marked as not for sale
      const productNotForSale = false; // Can't check templateSuffix from Storefront API
      
      // Extract numeric variant ID from GID for form submission
      const extractNumericId = (gid) => {
        if (!gid) return '';
        if (/^\d+$/.test(gid)) return gid;
        const match = gid.match(/\/(\d+)$/);
        return match ? match[1] : '';
      };
      const variantId = firstVariant ? extractNumericId(firstVariant.id) : '';
      const variantAvailable = firstVariant?.availableForSale !== false;
      
      // Card classes - match Liquid exactly
      const cardClasses = [
        'card',
        'card--product',
        isGroup ? 'card--product-group' : '',
        'h-full',
        this.cardContain ? 'card--product-contained' : '',
        !this.showDividers ? 'card--no-lines' : '',
        enableCompare ? 'card--product-compare' : '',
        'relative',
        'flex'
      ].filter(Boolean).join(' ');
      
      // Price position class
      const priceClass = this.cardPriceBottom ? 'price--bottom' : 'price--top';
      const infoInnerClass = this.cardPriceBottom ? 'flex flex-col h-full' : 'inline-block';
      
      // Icon SVG (from icon-add-to-cart.liquid)
      const addToCartIcon = '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" role="presentation" class="icon"><path d="M12.12 20.44H5.6V9.56h12.8v3.73c.06.4.4.69.8.7.44 0 .8-.35.8-.8v-4.5a.792.792 0 0 0-.8-.69H17V6.5C16.9 4 14.7 2 12 2S7 4.09 7 6.67V8H4.71c-.4.04-.71.37-.71.78v12.53a.8.8 0 0 0 .8.69h7.43c.38-.06.67-.39.67-.78 0-.43-.35-.78-.78-.78ZM8.66 6.67c0-1.72 1.49-3.11 3.33-3.11s3.33 1.39 3.33 3.11V8H8.65V6.67Z"/><path d="M20 17.25h-2.4v-2.5a.817.817 0 0 0-.8-.7c-.44 0-.8.36-.8.8v2.4h-2.5c-.4.06-.7.4-.7.8 0 .44.36.8.8.8H16v2.5c.06.4.4.7.8.7.44 0 .8-.36.8-.8v-2.4h2.5c.4-.06.69-.4.7-.8 0-.44-.35-.8-.8-.8Z"/></svg>';
      
      // Generate unique form ID
      const productFormId = `product-form-${product.id.replace(/[^0-9]/g, '')}`;
      
      // Build card HTML matching Liquid structure EXACTLY
      const cardHTML = `
        <product-card class="${cardClasses}" data-group-size="${groupSize}">
          ${isGroup ? `
            <div class="card__group-indicator absolute top-2 right-2 text-xs px-2 py-1 rounded-full z-10">
              ${groupSize + 1} copies available
            </div>
          ` : ''}
          ${enableCompare ? `
            <div class="card__compare no-js-hidden text-sm">
              <input type="checkbox" class="checkbox checkbox--compare js-compare-checkbox" 
                     id="compare-${product.id}" 
                     data-product-id="${product.id}" 
                     data-product-url="${productUrl}">
              <label for="compare-${product.id}">Compare</label>
            </div>
          ` : ''}
          <div class="card__media relative">
            <a href="${productUrl}" aria-label="${this.escapeHtml(product.title)}" 
               class="media block relative js-prod-link" 
               style="padding-top: 100%;" tabindex="-1">
              ${imageUrl ? `
                <img src="${imageUrl}&width=460" 
                     alt="${this.escapeHtml(imageAlt)}"
                     class="img-fit card__main-image"
                     loading="lazy"
                     width="460"
                     height="460">
              ` : `
                <div class="media__placeholder img-fit">No image</div>
              `}
            </a>
          </div>
          <div class="card__info-container flex flex-col flex-auto relative">
            <div class="card__info w-full">
              <div class="card__info-inner ${infoInnerClass} w-full">
                ${vendor ? `
                  <p class="card__vendor${this.showDividers ? ' mb-1' : ' mb-0'} text-sm text-theme-light">${this.escapeHtml(vendor)}</p>
                ` : ''}
                <p class="card__title font-bold${this.showDividers ? ' mb-1' : ' mt-1 mb-0'}">
                  <a href="${productUrl}" class="card-link text-current js-prod-link">
                    ${this.escapeHtml(cleanTitle)}${displayFormat ? ` <span> - ${this.escapeHtml(displayFormat)}</span>` : ''}${!isGroup && gradeCondition ? ` <span style="font-weight: bold; font-style: italic;"> - ${this.escapeHtml(gradeCondition)}</span>` : ''}
                  </a>
                </p>
                ${isGroup ? `
                  <p class="card__group-info text-xs text-theme-light mb-1">
                    ${groupSize + 1} copies available.
                  </p>
                ` : ''}
                ${!this.cardPriceBottom ? `
                  <div class="price ${priceClass}">
                    <div class="price__default">
                      ${showFromPrice ? `
                        <span class="price__current">
                          <span class="price__from">${fromText}</span>
                          <span class="js-value">${this.formatPrice({ amount: lowestPrice, currencyCode: currency })}</span>
                        </span>
                      ` : isOnSale ? `
                        <span class="price__current">
                          <span class="price__sale">${this.formatPrice({ amount: price, currencyCode: currency })}</span>
                          <span class="price__compare">${this.formatPrice({ amount: comparePrice, currencyCode: currency })}</span>
                        </span>
                      ` : `
                        <span class="price__current">
                          <span class="js-value">${this.formatPrice({ amount: price, currencyCode: currency })}</span>
                        </span>
                      `}
                    </div>
                  </div>
                ` : ''}
              </div>
            </div>
            ${this.cardPriceBottom ? `
              <div class="mt-auto">
                <div class="price ${priceClass}">
                  <div class="price__default">
                    ${showFromPrice ? `
                      <span class="price__current">
                        <span class="price__from">${fromText}</span>
                        <span class="js-value">${this.formatPrice({ amount: lowestPrice, currencyCode: currency })}</span>
                      </span>
                    ` : isOnSale ? `
                      <span class="price__current">
                        <span class="price__sale">${this.formatPrice({ amount: price, currencyCode: currency })}</span>
                        <span class="price__compare">${this.formatPrice({ amount: comparePrice, currencyCode: currency })}</span>
                      </span>
                    ` : `
                      <span class="price__current">
                        <span class="js-value">${this.formatPrice({ amount: price, currencyCode: currency })}</span>
                      </span>
                    `}
                  </div>
                </div>
              </div>
            ` : ''}
            ${!productNotForSale ? `
              <div class="card__actions">
                ${groupSize > 0 ? `
                  <div class="no-js-hidden">
                    <button type="button"
                            class="btn btn--primary w-full js-quick-add btn--select-copy"
                            aria-haspopup="dialog"
                            data-product-url="${productUrl}"
                            data-product-default-variant="${hasOnlyDefaultVariant}"
                            data-group-variants="${variantHandles || ''}">
                      <span class="quick-add-btn-icon block pointer-events-none">
                        <span class="visually-hidden">Choose copy</span>
                        ${addToCartIcon}
                      </span>
                      <span class="quick-add-btn-text block pointer-events-none">
                        CHOOSE COPY (from ${groupSize + 1})
                      </span>
                    </button>
                    <a href="${productUrl}" class="btn btn--secondary quick-add-view-btn">
                      View details
                    </a>
                  </div>
                ` : hasOnlyDefaultVariant && this.enableQuickAdd ? `
                  <product-form class="product-form">
                    <form action="/cart/add" method="post" enctype="multipart/form-data" id="${productFormId}" class="form" novalidate="novalidate" data-type="add-to-cart-form">
                      <input type="hidden" name="id" value="${variantId}">
                      <button type="submit"
                              name="add"
                              class="btn btn--primary w-full quick-add-btn"
                              aria-haspopup="dialog"
                              aria-labelledby="${productFormId}-submit title-${this.sectionId}-${product.id}"
                              aria-live="polite"
                              data-sold-out-message="true"
                              ${!variantAvailable ? 'disabled' : ''}>
                        <span class="quick-add-btn-icon block pointer-events-none">
                          <span class="visually-hidden">View product</span>
                          ${addToCartIcon}
                        </span>
                        <span class="quick-add-btn-text block pointer-events-none">
                          ${variantAvailable ? 'View product' : 'Sold out'}
                        </span>
                      </button>
                    </form>
                  </product-form>
                ` : `
                  <div class="no-js-hidden">
                    <button type="button"
                            class="btn btn--primary w-full js-quick-add"
                            aria-haspopup="dialog"
                            data-product-url="${productUrl}"
                            data-product-default-variant="${hasOnlyDefaultVariant}"
                            data-group-variants="">
                      <span class="quick-add-btn-icon block pointer-events-none">
                        <span class="visually-hidden">Choose options</span>
                        ${addToCartIcon}
                      </span>
                      <span class="quick-add-btn-text block pointer-events-none">
                        Choose options
                      </span>
                    </button>
                    <a href="${productUrl}" class="btn btn--secondary quick-add-view-btn">
                      View details
                    </a>
                  </div>
                `}
              </div>
            ` : ''}
          </div>
        </product-card>
      `;
      
      li.innerHTML = cardHTML;
      return li;
    }
    
    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
    
    
    /**
     * Renders fetched card results into the grid
     */
    renderResults(grid, results, startIndex) {
      if (!grid) {
        window.themeLogger?.error('🔴 CollectionGroupingEnhancer: Grid element is null!');
        return;
      }
      
      let addedCount = 0;
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result.status === 'fulfilled' && result.value && result.value.cardElement) {
          const clonedCard = result.value.cardElement.cloneNode(true);
          grid.appendChild(clonedCard);
          addedCount++;
          this.renderedCount++;
        } else if (result.status === 'rejected') {
          this.debugLog('🔴 CollectionGroupingEnhancer: Failed to fetch card:', result.reason);
        } else {
          window.themeLogger?.warn('🔴 CollectionGroupingEnhancer: Invalid result:', result);
        }
      }
      
      window.themeLogger?.log(`🟣 CollectionGroupingEnhancer: Added ${addedCount} cards to grid. Grid now has ${grid.children.length} children.`);
      
      // Reinitialize components after rendering (only if we've rendered new cards)
      if (addedCount > 0) {
        this.reinitializeComponents();
      }
    }
    
    /**
     * Sets up virtual scrolling to load more cards as user scrolls
     */
    setupVirtualScrolling(grid, batchFetchSize, scrollBatchSize) {
      // Create a sentinel element at the bottom to detect when user scrolls near it
      const sentinel = document.createElement('div');
      sentinel.className = 'js-grouping-sentinel';
      sentinel.style.height = '100px';
      sentinel.style.width = '100%';
      grid.parentElement.appendChild(sentinel);
      
      // Use IntersectionObserver to detect when sentinel is visible
      const observer = new IntersectionObserver(
        async (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting && !this.isLoading && this.renderedCount < this.allFetchPromises.length) {
              // User scrolled near bottom, load next batch
              const nextBatchStart = this.renderedCount;
              await this.renderBatch(grid, nextBatchStart, scrollBatchSize, batchFetchSize);
              
              // If all cards rendered, remove sentinel
              if (this.renderedCount >= this.allFetchPromises.length) {
                observer.disconnect();
                sentinel.remove();
                window.themeLogger?.log('🟣 CollectionGroupingEnhancer: All cards rendered');
              }
            }
          }
        },
        { rootMargin: '200px' } // Start loading 200px before sentinel is visible
      );
      
      observer.observe(sentinel);
      this.scrollObserver = observer;
      this.scrollSentinel = sentinel;
    }

    reinitializeComponents() {
      // Reinitialize carousels
      const carousels = document.querySelectorAll('carousel-slider');
      carousels.forEach(carousel => {
        if (typeof carousel.init === 'function') {
          carousel.init();
        }
      });

      // Reinitialize animations
      const animatedElements = document.querySelectorAll('[data-cc-animate]');
      animatedElements.forEach(el => {
        if (!el.classList.contains('cc-animate-init')) {
          el.classList.add('cc-animate-init');
          if (el.getBoundingClientRect().top < window.innerHeight + 500) {
            el.classList.add('cc-animate-in');
          }
        }
      });
      
      // Reinitialize custom-pagination component (if it exists)
      // This updates its internal references to the new product list
      const customPagination = document.querySelector('custom-pagination');
      if (customPagination && typeof customPagination.reload === 'function') {
        customPagination.reload();
      }
    }
  }

  customElements.define('collection-grouping-enhancer', CollectionGroupingEnhancer);
}
