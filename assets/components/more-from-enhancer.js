/**
 * More From Enhancer - Uses Storefront API to fetch products beyond Liquid's 50 limit
 * Automatically enhances "more from" sections when collections don't exist or are limited
 * Now includes product grouping by artist + album + format
 */
if (!customElements.get('more-from-enhancer')) {
  class MoreFromEnhancer extends HTMLElement {
    constructor() {
      super();
      this.enhanced = false;
      this.apiClient = null;
      this.logContainer = null;
      this.init();
    }

    /**
     * Create debug panel if it doesn't exist
     */
    createDebugPanel() {
      // Check if panel already exists
      const existingPanel = document.getElementById('grouping-debug-panel');
      if (existingPanel) {
        this.logContainer = document.querySelector('#debug-log-container');
        return;
      }

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
      header.style.cssText =
        'color: #fff; font-weight: bold; margin-bottom: 5px; border-bottom: 1px solid #333; padding-bottom: 5px;';
      header.textContent = 'More From Debug';

      const closeBtn = document.createElement('button');
      closeBtn.textContent = '×';
      closeBtn.style.cssText =
        'float: right; background: none; border: none; color: #fff; font-size: 16px; cursor: pointer;';
      closeBtn.onclick = () => panel.remove();
      header.appendChild(closeBtn);

      const logContainer = document.createElement('div');
      logContainer.id = 'debug-log-container';
      logContainer.style.cssText = 'max-height: 250px; overflow-y: auto;';

      panel.appendChild(header);
      panel.appendChild(logContainer);
      document.body.appendChild(panel);

      this.logContainer = logContainer;
    }

    /**
     * Debug logging (console + on-screen panel)
     */
    debugLog(message, data = null) {
      // Log to console
      if (data !== null) {
        console.log(message, data);
      } else {
        console.log(message);
      }

      // Create debug panel if it doesn't exist
      if (!this.logContainer) {
        this.createDebugPanel();
      }

      // Log to on-screen panel if available
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
      this.debugLog('🔵 MoreFromEnhancer: init() called');

      // Wait for DOM to be ready
      if (document.readyState === 'loading') {
        this.debugLog('🔵 MoreFromEnhancer: Document still loading, waiting for DOMContentLoaded');
        document.addEventListener('DOMContentLoaded', () => {
          this.debugLog('🔵 MoreFromEnhancer: DOMContentLoaded fired, calling checkAndEnhance()');
          this.checkAndEnhance();
        });
      } else {
        this.debugLog('🔵 MoreFromEnhancer: Document ready, calling checkAndEnhance() immediately');
        this.checkAndEnhance();
      }
    }

    async checkAndEnhance() {
      this.debugLog('🟢 MoreFromEnhancer: checkAndEnhance() called');

      // Find all "more from" section wrappers
      const wrappers = document.querySelectorAll(
        '.dynamic-artist-collection-wrapper, .dynamic-label-collection-wrapper, .dynamic-genre-collection-wrapper'
      );
      this.debugLog(`🟢 MoreFromEnhancer: Found ${wrappers.length} wrapper(s)`);

      for (const wrapper of wrappers) {
        this.debugLog('🟢 MoreFromEnhancer: Processing wrapper', {
          classes: wrapper.className,
          useSectionApi: wrapper.dataset.useSectionApi,
          enhanced: wrapper.dataset.enhanced,
        });

        if (wrapper.dataset.useSectionApi === 'true' && !wrapper.dataset.enhanced) {
          await this.enhanceSection(wrapper);
        }
      }
    }

    async enhanceSection(wrapper) {
      const sectionId = wrapper.dataset.sectionId;
      const currentProductId = wrapper.dataset.currentProductId;

      // Determine search type and value
      let searchType = '';
      let searchValue = '';

      if (wrapper.classList.contains('dynamic-artist-collection-wrapper')) {
        searchType = 'artist';
        searchValue = wrapper.dataset.artist;
      } else if (wrapper.classList.contains('dynamic-label-collection-wrapper')) {
        searchType = 'label';
        searchValue = wrapper.dataset.label;
      } else if (wrapper.classList.contains('dynamic-genre-collection-wrapper')) {
        searchType = 'genre';
        searchValue = wrapper.dataset.genre;
      }

      if (!searchType || !searchValue || !sectionId) {
        return;
      }

      // Initialize Storefront API client if available
      if (typeof window.StorefrontAPIClient !== 'undefined' && !this.apiClient) {
        this.apiClient = new window.StorefrontAPIClient();
      }

      this.debugLog(`🟢 MoreFromEnhancer: Enhancing ${searchType} section for "${searchValue}"`);

      // Initialize API client if needed
      if (!this.apiClient && window.StorefrontAPIClient) {
        this.debugLog('🔵 MoreFromEnhancer: Initializing StorefrontAPIClient');
        try {
          this.apiClient = new window.StorefrontAPIClient();
          this.debugLog('🟢 MoreFromEnhancer: StorefrontAPIClient initialized successfully');

          // Test if the client has the required methods
          if (typeof this.apiClient.searchProducts !== 'function') {
            this.debugLog('🔴 MoreFromEnhancer: searchProducts method not found on API client');
          }
        } catch (apiError) {
          this.debugLog('🔴 MoreFromEnhancer: Error initializing StorefrontAPIClient', {
            error: apiError.message || apiError,
            stack: apiError.stack,
          });
        }
      } else if (!window.StorefrontAPIClient) {
        this.debugLog('🔴 MoreFromEnhancer: StorefrontAPIClient not available on window object');
      }

      // Always use Storefront API for comprehensive results and proper grouping
      if (this.apiClient) {
        this.debugLog('🟢 MoreFromEnhancer: Using Storefront API');
        await this.fetchAndGroupViaStorefrontAPI(
          searchType,
          searchValue,
          currentProductId,
          wrapper
        );
      } else {
        this.debugLog('🔴 MoreFromEnhancer: StorefrontAPIClient not available, using fallback');
        // Fallback to Section Rendering API if Storefront API not available
        await this.fetchViaSectionAPI(
          sectionId,
          searchType,
          searchValue,
          currentProductId,
          wrapper
        );
      }
    }

    async fetchAndGroupViaStorefrontAPI(
      searchType,
      searchValue,
      currentProductId,
      wrapper,
      append = false
    ) {
      // Build search query outside try/catch so it's accessible in catch block
      const searchQuery = this.buildStorefrontSearchQuery(searchType, searchValue);

      try {
        this.debugLog(
          `🟢 MoreFromEnhancer: Starting Storefront API fetch for ${searchType}: "${searchValue}"`
        );
        this.debugLog(`🟢 MoreFromEnhancer: Built search query: "${searchQuery}"`);

        // Fetch products via Storefront API
        const products = [];
        let cursor = null;
        let hasNextPage = true;
        const limit = 100;

        while (hasNextPage && products.length < 200) {
          // Limit to 200 for "more from" sections
          this.debugLog(`🟢 MoreFromEnhancer: Fetching batch, cursor: ${cursor || 'null'}`);

          try {
            // Call with correct parameter order: query, cursor, limit
            const data = await this.apiClient.searchProducts(searchQuery, cursor, limit);
            this.debugLog('🟢 MoreFromEnhancer: API response received', {
              hasProducts: !!data.products,
              edgeCount: data.products?.edges?.length || 0,
            });

            if (!data.products || !data.products.edges) {
              break;
            }

            const pageProducts = data.products.edges
              .map((edge) => edge.node)
              .filter((product) => product.id !== currentProductId);

            products.push(...pageProducts);

            hasNextPage = data.products.pageInfo.hasNextPage;
            cursor = data.products.pageInfo.endCursor;

            if (!hasNextPage) {
              break;
            }
          } catch (batchError) {
            this.debugLog('🔴 MoreFromEnhancer: Error in batch fetch', {
              error: batchError.message || batchError,
              stack: batchError.stack,
              searchQuery,
              cursor,
            });
            throw batchError;
          }
        }

        this.debugLog(`🟢 MoreFromEnhancer: Fetched ${products.length} total products`);

        if (products.length === 0) {
          this.debugLog('🟡 MoreFromEnhancer: No products found');
          return;
        }

        // Group products
        this.debugLog('🟢 MoreFromEnhancer: Grouping products');
        const grouped = this.groupProducts(products);
        this.debugLog(
          `🟢 MoreFromEnhancer: Created ${grouped.groups.length} groups and ${grouped.singles.length} singles`
        );

        // Render grouped products
        this.debugLog('🟢 MoreFromEnhancer: Rendering grouped products');
        await this.renderGroupedProducts(grouped, wrapper, append);
      } catch (error) {
        this.debugLog('🔴 MoreFromEnhancer: Error fetching via Storefront API', {
          error: error.message || error,
          stack: error.stack,
          searchType,
          searchValue,
          searchQuery: searchQuery,
        });
        // Fallback to Section Rendering API
        const sectionId = wrapper.dataset.sectionId;
        await this.fetchViaSectionAPI(
          sectionId,
          searchType,
          searchValue,
          currentProductId,
          wrapper,
          append
        );
      }
    }

    buildStorefrontSearchQuery(searchType, searchValue) {
      // Storefront API search query format
      // Note: Storefront API doesn't support metafield searches directly
      // We'll search by title, vendor, or tags which often contain the same info
      let query = '';

      if (searchType === 'artist') {
        // Search in title and vendor fields for artist name
        query = `title:*${searchValue}* OR vendor:*${searchValue}*`;
      } else if (searchType === 'label') {
        // Search in vendor field for label name
        query = `vendor:*${searchValue}*`;
      } else if (searchType === 'genre') {
        // Search in tags for genre
        query = `tag:${searchValue}`;
      } else {
        query = searchValue;
      }

      this.debugLog(`🔵 MoreFromEnhancer: Built search query for ${searchType}`, {
        originalValue: searchValue,
        finalQuery: query,
        note: 'Using title/vendor/tags instead of metafields for Storefront API compatibility',
      });

      return query;
    }

    groupProducts(products) {
      // Use same grouping logic as collection-grouping-enhancer
      const getFormat = (productType) => {
        if (!productType) {
          return '';
        }
        const type = productType.trim().toLowerCase();
        if (type.includes('12')) {
          return '12"';
        }
        if (type.includes('10')) {
          return '10"';
        }
        if (type.includes('7')) {
          return '7"';
        }
        if (type.includes('box')) {
          if (type.includes('lp') || type.includes('vinyl')) {
            return 'LP Box';
          }
          if (type.includes('cd')) {
            return 'CD Box';
          }
          return 'Box Set';
        }
        if (type.includes('lp')) {
          return 'LP';
        }
        if (type.includes('cd')) {
          return 'CD';
        }
        if (type.includes('cassette')) {
          return 'Cassette';
        }
        if (type.includes('ep')) {
          return 'EP';
        }
        if (type.includes('dvd')) {
          return 'DVD';
        }
        if (type.includes('blu')) {
          return 'Blu-ray';
        }
        if (type.includes('vhs')) {
          return 'VHS';
        }
        return '';
      };

      const groupMap = new Map();
      const singles = [];
      const usedHandles = new Set();

      // Group products
      for (const product of products) {
        const artist = product.artist && product.artist.value ? product.artist.value.trim() : '';
        const album =
          product.title_metafield && product.title_metafield.value
            ? product.title_metafield.value.trim()
            : '';
        const format = getFormat(product.productType);

        this.debugLog('🔵 MoreFromEnhancer: Processing product for grouping', {
          handle: product.handle,
          title: product.title,
          artist: artist || 'NO ARTIST',
          album: album || 'NO ALBUM',
          format: format || 'NO FORMAT',
          productType: product.productType,
        });

        if (!artist || !album) {
          singles.push(product);
          continue;
        }

        const groupKey = `${artist.toLowerCase()}|${album.toLowerCase()}|${format}`;

        if (!groupMap.has(groupKey)) {
          groupMap.set(groupKey, []);
        }
        groupMap.get(groupKey).push(product);
      }

      // Build groups array
      const groups = [];
      for (const [groupKey, groupProducts] of groupMap.entries()) {
        if (groupProducts.length > 1) {
          groups.push({
            mainProduct: groupProducts[0],
            variantProducts: groupProducts.slice(1),
            format: groupKey.split('|')[2],
          });
          groupProducts.forEach((p) => usedHandles.add(p.handle));
        } else if (groupProducts.length === 1 && !usedHandles.has(groupProducts[0].handle)) {
          singles.push(groupProducts[0]);
          usedHandles.add(groupProducts[0].handle);
        }
      }

      this.debugLog('🔵 MoreFromEnhancer: Grouping complete', {
        totalGroups: groups.length,
        totalSingles: singles.length,
        groupKeys: Array.from(groupMap.keys()).slice(0, 5), // Show first 5 group keys
      });

      return { groups, singles };
    }

    async renderGroupedProducts(grouped, wrapper, append = false) {
      this.debugLog('🔵 MoreFromEnhancer: Starting renderGroupedProducts', {
        groupsCount: grouped.groups.length,
        singlesCount: grouped.singles.length,
        wrapperClasses: wrapper.className,
      });

      // Find or create container
      let container = wrapper.querySelector(
        'ul.slider__grid, .products-grid-container ul, ul.grid'
      );
      this.debugLog('🔵 MoreFromEnhancer: Container search result', {
        containerFound: !!container,
        containerClasses: container ? container.className : 'NOT FOUND',
      });

      if (!container) {
        this.debugLog('🟡 MoreFromEnhancer: No container found, creating one');
        // Create container if it doesn't exist
        const gridContainer = document.createElement('div');
        gridContainer.className = 'container products-grid-container';
        container = document.createElement('ul');
        container.className = 'grid gap-x-theme gap-y-8';
        container.setAttribute('role', 'list');
        gridContainer.appendChild(container);
        wrapper.appendChild(gridContainer);
      }

      if (!append) {
        container.innerHTML = '';
      }

      // Use Section Rendering API to fetch product cards
      // Build items array with product handles and variant info for Section Rendering API
      const allItems = [
        ...grouped.groups.map((g) => ({
          productHandle: g.mainProduct.handle,
          productId: g.mainProduct.id.replace('gid://shopify/Product/', ''),
          isGroup: true,
          variantHandles: g.variantProducts.map((p) => p.handle).join(','),
          groupFormat: g.format,
          // Pass full product data for fallback rendering
          productData: g.mainProduct,
          variantProductsData: g.variantProducts,
        })),
        ...grouped.singles.map((p) => ({
          productHandle: p.handle,
          productId: p.id.replace('gid://shopify/Product/', ''),
          isGroup: false,
          // Pass full product data for fallback rendering
          productData: p,
        })),
      ];

      this.debugLog(`🔵 MoreFromEnhancer: Built ${allItems.length} items for rendering`, {
        firstFewItems: allItems.slice(0, 3),
        totalGroups: grouped.groups.length,
        totalSingles: grouped.singles.length,
      });

      // Use Section Rendering API with enhanced product data passing
      const sectionId = 'product-group-card-renderer';
      this.debugLog(
        `🔵 MoreFromEnhancer: Starting Section Rendering API calls for ${allItems.length} items`
      );

      const cardPromises = allItems.slice(0, 8).map(async (item, index) => {
        try {
          const params = new URLSearchParams({
            product_handle: item.productHandle,
            product_id: item.productId,
            section_id: sectionId,
            // Pass product data as JSON for the Liquid section to use
            product_title: item.productData.title,
            product_price: item.productData.priceRange.minVariantPrice.amount,
            product_image: item.productData.featuredImage ? item.productData.featuredImage.url : '',
          });

          if (item.isGroup) {
            params.append('variant_handles', item.variantHandles);
            params.append('group_formats', item.groupFormat);
            params.append('variant_count', item.variantProductsData.length.toString());
          }

          // Try using POST with form data since query parameters are stripped
          const url = '/collections/all';
          const formData = new FormData();

          // Add all parameters as form data
          for (const [key, value] of params.entries()) {
            formData.append(key, value);
          }

          this.debugLog(
            `🔵 MoreFromEnhancer: Fetching card ${index + 1}/${Math.min(8, allItems.length)}`,
            {
              productHandle: item.productHandle,
              url: url,
              method: 'POST',
              formDataEntries: Array.from(formData.entries()),
            }
          );

          const response = await fetch(url, {
            method: 'POST',
            body: formData,
          });

          // Log response details
          this.debugLog(`🔵 MoreFromEnhancer: Response received for ${item.productHandle}`, {
            status: response.status,
            statusText: response.statusText,
            contentType: response.headers.get('content-type'),
            url: response.url,
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const html = await response.text();

          // Log detailed HTML inspection
          this.debugLog(`🔵 MoreFromEnhancer: HTML analysis for ${item.productHandle}`, {
            htmlLength: html.length,
            htmlPreview: html.substring(0, 500),
            containsProductGroupRenderer: html.includes('product-group-card-renderer'),
            containsShopifySection: html.includes('shopify-section-'),
            containsDataSectionId: html.includes('data-section-id='),
            containsScript: html.includes('<script>'),
            containsDebugData: html.includes('LIQUID DEBUG DATA'),
          });

          const parser = new DOMParser();
          const doc = parser.parseFromString(html, 'text/html');

          // Extract the card from the section
          const section = doc.querySelector(`#shopify-section-${sectionId}`);
          if (section) {
            const card = section.querySelector('li');
            if (card) {
              this.debugLog(`🟢 MoreFromEnhancer: Card extracted for ${item.productHandle}`, {
                cardFound: true,
                cardHTML: `${card.outerHTML.substring(0, 200)}...`,
              });
              return card.outerHTML;
            }
          }

          this.debugLog(`🟡 MoreFromEnhancer: Section not found for ${item.productHandle}`);
          return null;
        } catch (error) {
          this.debugLog(`🔴 MoreFromEnhancer: Error fetching card for ${item.productHandle}`, {
            error: error.message,
          });
          return null;
        }
      });

      const cards = await Promise.all(cardPromises);
      this.debugLog('🔵 MoreFromEnhancer: Section API calls completed', {
        totalCalls: cardPromises.length,
        successfulCards: cards.filter((c) => c !== null).length,
        failedCards: cards.filter((c) => c === null).length,
      });

      // Append valid cards to container
      let insertedCount = 0;
      cards.forEach((cardHtml, index) => {
        if (cardHtml) {
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = cardHtml;
          const cardElement = tempDiv.firstElementChild;
          if (cardElement) {
            container.appendChild(cardElement);
            insertedCount++;
            this.debugLog(`🟢 MoreFromEnhancer: Inserted card ${insertedCount}`, {
              cardClasses: cardElement.className,
            });
          }
        }
      });

      this.debugLog('🟢 MoreFromEnhancer: Rendering complete', {
        totalInserted: insertedCount,
        containerChildren: container.children.length,
      });

      wrapper.dataset.enhanced = 'true';
    }

    async groupExistingProducts(wrapper) {
      // Extract product data from existing DOM and re-group
      // This is complex, so for now we'll skip it
      // The Liquid grouping should already be applied
      console.log('MoreFromEnhancer: Products already exist, skipping grouping');
    }

    async fetchViaSectionAPI(
      sectionId,
      searchType,
      searchValue,
      currentProductId,
      wrapper,
      append = false
    ) {
      try {
        // Step 1: Use Search API to find products by metafield (no 50 limit)
        const searchQuery = this.buildSearchQuery(searchType, searchValue);
        const searchResponse = await fetch(
          `/search/suggest.json?q=${encodeURIComponent(searchQuery)}&resources[type]=product&resources[limit]=100`
        );
        const searchData = await searchResponse.json();

        if (!searchData.resources?.results?.products) {
          return;
        }

        // Step 2: Get product handles, excluding current product
        const productHandles = searchData.resources.results.products
          .filter((p) => p.id.toString() !== currentProductId)
          .slice(0, 100)
          .map((p) => p.handle);

        if (productHandles.length === 0) {
          return;
        }

        // Step 3: Fetch products via Section Rendering API using search with product IDs
        // Build search query with product IDs
        const productIdQuery = productHandles.map((h) => `id:${h}`).join(' OR ');
        const params = new URLSearchParams({
          q: productIdQuery,
          type: 'product',
          section_id: sectionId,
        });

        // Use search endpoint for Section Rendering API
        const fetchUrl = `/search?${params.toString()}`;
        const response = await fetch(fetchUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Find the section in the response (search results will have the section)
        const sectionElement =
          doc.querySelector(`[data-section-id="${sectionId}"]`) ||
          doc.querySelector(`.${wrapper.className.split(' ')[0]}`);

        if (!sectionElement) {
          // Try to find products in search results directly
          const searchProducts = doc.querySelectorAll('.product-card, [data-product-handle]');
          if (searchProducts.length > 0) {
            await this.renderProducts(searchProducts, wrapper, append);
            return;
          }
          return;
        }

        // Find product containers in the section
        const newContainer = sectionElement.querySelector(
          'ul.slider__grid, .products-grid-container ul, ul.grid'
        );
        const existingContainer = wrapper.querySelector(
          'ul.slider__grid, .products-grid-container ul, ul.grid'
        );

        if (newContainer && existingContainer) {
          await this.renderProducts(
            Array.from(newContainer.querySelectorAll('li')),
            wrapper,
            append,
            existingContainer
          );
        }
      } catch (error) {
        console.error('MoreFromEnhancer: Error fetching via Section Rendering API:', error);
      }
    }

    buildSearchQuery(searchType, searchValue) {
      // Build search query for metafield search
      if (searchType === 'artist') {
        return `metafields.custom.artist:${searchValue}`;
      } else if (searchType === 'label') {
        return `metafields.custom.computed_master_label:${searchValue}`;
      } else if (searchType === 'genre') {
        return `metafields.custom.computed_style_genre:${searchValue}`;
      }
      return searchValue;
    }

    async renderProducts(newItems, wrapper, append, existingContainer) {
      if (!existingContainer) {
        existingContainer = wrapper.querySelector(
          'ul.slider__grid, .products-grid-container ul, ul.grid'
        );
      }
      if (!existingContainer) {
        return;
      }

      if (append) {
        // Append new products that don't already exist
        const existingHandles = new Set(
          Array.from(
            existingContainer.querySelectorAll('[data-product-handle], a[href*="/products/"]')
          )
            .map((el) => {
              const handle = el.dataset?.productHandle;
              if (handle) {
                return handle;
              }
              const href = el.getAttribute('href');
              if (href) {
                const match = href.match(/\/products\/([^/?]+)/);
                if (match) {
                  return match[1];
                }
              }
              return null;
            })
            .filter(Boolean)
        );

        newItems.forEach((item) => {
          const handle =
            item.querySelector('[data-product-handle]')?.dataset.productHandle ||
            item.querySelector('a[href*="/products/"]')?.href.match(/\/products\/([^/?]+)/)?.[1];
          if (handle && !existingHandles.has(handle)) {
            existingContainer.appendChild(item.cloneNode(true));
            existingHandles.add(handle);
          }
        });
      } else {
        // Replace entire content
        existingContainer.innerHTML = '';
        newItems.forEach((item) => {
          existingContainer.appendChild(item.cloneNode(true));
        });
      }

      // Reinitialize carousel if needed
      const carousel = wrapper.closest('carousel-slider');
      if (carousel) {
        // Trigger carousel reinit
        if (typeof carousel.init === 'function') {
          carousel.init();
        } else {
          // Dispatch event to trigger carousel update
          carousel.dispatchEvent(new Event('update'));
        }
      }

      // Trigger animations for new elements
      const newElements = existingContainer.querySelectorAll('[data-cc-animate]');
      newElements.forEach((el) => {
        if (!el.classList.contains('cc-animate-init')) {
          el.classList.add('cc-animate-init');
          if (el.getBoundingClientRect().top < window.innerHeight + 500) {
            el.classList.add('cc-animate-in');
          }
        }
      });

      wrapper.dataset.enhanced = 'true';
    }
  }

  customElements.define('more-from-enhancer', MoreFromEnhancer);

  // Auto-initialize
  console.log('🔵 MoreFromEnhancer: Script loaded, setting up DOMContentLoaded listener');

  document.addEventListener('DOMContentLoaded', () => {
    console.log('🔵 MoreFromEnhancer: DOMContentLoaded - Creating enhancer element');

    // Check if we're on a product page
    const isProductPage = window.location.pathname.includes('/products/');
    console.log('🔵 MoreFromEnhancer: Is product page:', isProductPage);

    // Check if dynamic sections exist
    const wrappers = document.querySelectorAll(
      '.dynamic-artist-collection-wrapper, .dynamic-label-collection-wrapper, .dynamic-genre-collection-wrapper'
    );
    console.log('🔵 MoreFromEnhancer: Found wrappers on page load:', wrappers.length);

    const enhancer = document.createElement('more-from-enhancer');
    document.body.appendChild(enhancer);
    console.log('🔵 MoreFromEnhancer: Enhancer element created and added to body');
  });
}
