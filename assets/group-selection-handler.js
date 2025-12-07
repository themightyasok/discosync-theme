/**
 * Group Selection Handler
 * Handles opening and populating the group selection drawer for grouped products
 */

if (!customElements.get('group-selection-handler')) {
  class GroupSelectionHandler {
    constructor() {
      this.init();
    }

    init() {
      // Listen for clicks on quick-add buttons with data-group-variants
      document.addEventListener('click', this.handleQuickAddClick.bind(this));
    }

    /**
     * Handles click events on quick-add buttons
     * @param {Event} evt - Click event
     */
    handleQuickAddClick(evt) {
      // Handle clicks on product links within grouped products
      const productLink = evt.target.closest('.js-prod-link');
      if (productLink) {
        const productCard = productLink.closest('product-card');
        if (
          productCard &&
          productCard.dataset.groupSize &&
          parseInt(productCard.dataset.groupSize) >= 1
        ) {
          evt.preventDefault();
          evt.stopPropagation();

          // Find the quick-add button in this card and trigger group selection
          const quickAddButton = productCard.querySelector('.js-quick-add[data-group-variants]');
          if (quickAddButton) {
            this.showGroupSelectionDrawer(quickAddButton);
          }
          return;
        }
      }

      // Handle clicks on quick-add buttons directly
      const button = evt.target.closest('.js-quick-add[data-group-variants]');
      if (button && button.dataset.groupVariants && button.dataset.groupVariants.trim() !== '') {
        evt.preventDefault();
        evt.stopPropagation();
        this.showGroupSelectionDrawer(button);
      }
    }

    /**
     * Shows the group selection drawer for grouped products
     * @param {Element} opener - Element that triggered opening of the drawer
     */
    showGroupSelectionDrawer(opener) {
      const groupDrawer = document.querySelector('group-selection-drawer');
      if (!groupDrawer) {
        console.error('Group selection drawer not found');
        return;
      }

      // Get the main product handle from the URL
      const productUrl = opener.dataset.productUrl || '';
      const mainHandle = productUrl.split('/').pop().split('?')[0];

      // Get variant handles from the opener
      const variantHandles = opener.dataset.groupVariants
        ? opener.dataset.groupVariants
            .split(',')
            .map((h) => h.trim())
            .filter((h) => h !== '')
        : [];

      // Combine main product handle with variant handles
      const allHandles = mainHandle ? [mainHandle, ...variantHandles] : variantHandles;

      // Populate the drawer with variant information
      this.populateGroupDrawer(groupDrawer, allHandles, opener);

      // Open the drawer
      groupDrawer.open(opener);
    }

    /**
     * Populates the group selection drawer with variant products
     * @param {Element} drawer - The group selection drawer element
     * @param {Array<string>} variantHandles - Array of product handles in the group
     * @param {Element} opener - Element that triggered opening of the drawer
     */
    async populateGroupDrawer(drawer, variantHandles, opener) {
      const variantsContainer = drawer.querySelector('.js-group-variants');
      if (!variantsContainer) {
        return;
      }

      // Show loading state
      variantsContainer.innerHTML = '<div class="text-center p-4">Loading variants...</div>';

      try {
        // Fetch product data for each variant with metafields
        const variantPromises = variantHandles.map((handle) =>
          fetch(`/products/${handle}.js`)
            .then((response) => response.json())
            .then((product) =>
              // Get metafields from the product page HTML
              fetch(`/products/${handle}`)
                .then((response) => response.text())
                .then((html) => {
                  const parser = new DOMParser();
                  const doc = parser.parseFromString(html, 'text/html');

                  // Look for window.product object that contains metafields
                  const scripts = doc.querySelectorAll('script');

                  for (const script of scripts) {
                    if (script.textContent && script.textContent.includes('window.product = {')) {
                      try {
                        const scriptContent = script.textContent;
                        // Try to extract window.product object
                        let windowProductMatch = scriptContent.match(
                          /window\.product\s*=\s*({[\s\S]*?});/
                        );

                        if (!windowProductMatch) {
                          // More aggressive pattern
                          const startIndex = scriptContent.indexOf('window.product = {');
                          if (startIndex !== -1) {
                            let braceCount = 1;
                            let endIndex = startIndex;
                            for (
                              let i = startIndex + 'window.product = {'.length;
                              i < scriptContent.length;
                              i++
                            ) {
                              if (scriptContent[i] === '{') {
                                braceCount++;
                              }
                              if (scriptContent[i] === '}') {
                                braceCount--;
                                if (braceCount === 0) {
                                  endIndex = i;
                                  break;
                                }
                              }
                            }
                            if (endIndex > startIndex) {
                              const matchText = scriptContent.substring(
                                startIndex + 'window.product = '.length,
                                endIndex + 1
                              );
                              windowProductMatch = [matchText, matchText];
                            }
                          }
                        }

                        if (windowProductMatch) {
                          // eslint-disable-next-line no-eval
                          const windowProduct = eval(`(${windowProductMatch[1]})`);

                          if (windowProduct && windowProduct.metafields) {
                            product.metafields = windowProduct.metafields;
                            break;
                          }
                        }
                      } catch (e) {
                        // Continue to next script
                      }
                    }
                  }

                  return product;
                })
                .catch((error) => {
                  console.log('Error fetching HTML for', handle, error);
                  return product;
                })
            )
        );

        const variants = await Promise.all(variantPromises);

        // Sort variants by price (highest first)
        variants.sort((a, b) => b.price - a.price);

        // Generate HTML for each variant
        let variantsHTML = '';
        variants.forEach((variant) => {
          const condition = this.getConditionsFromMetafields(variant);
          const price = this.formatMoney(variant.price);
          const isAvailable = variant.available;

          // Get product image
          const productImage =
            variant.featured_image ||
            (variant.images && variant.images[0] ? variant.images[0] : null);
          const typeStr = (variant.type || '').toLowerCase();
          const titleStr = (variant.title || '').toLowerCase();
          const isContain =
            typeStr.includes('book') ||
            typeStr.includes('dvd') ||
            typeStr.includes('blu') ||
            typeStr.includes('cassette') ||
            typeStr.includes('magazine') ||
            typeStr.includes('vhs') ||
            titleStr.includes('(dvd)') ||
            titleStr.includes('(blu-ray)') ||
            titleStr.includes('(cassette)') ||
            titleStr.includes('(vhs)');
          const objFit = isContain ? 'contain' : 'cover';
          const imageHTML = productImage
            ? `<img src="${productImage}" alt="${variant.title}" class="variant-image" style="width: 60px; height: 60px; object-fit: ${objFit}; border-radius: 4px;">`
            : '';

          // Build condition display
          let conditionHTML = '';
          if (condition.media && condition.sleeve) {
            conditionHTML = `
              <div class="variant-condition" style="font-size: 0.9em; color: #666; margin: 4px 0;">
                <div>media condition: <span class="condition-tooltip media-condition">${this.escapeHtml(condition.media)}</span></div>
                <div>sleeve condition: <span class="condition-tooltip sleeve-condition">${this.escapeHtml(condition.sleeve)}</span></div>
              </div>
            `;
          } else if (condition.combined) {
            const combinedText = condition.combined;
            if (combinedText.includes('/')) {
              const parts = combinedText.split('/');
              if (parts.length >= 2) {
                conditionHTML = `
                  <div class="variant-condition" style="font-size: 0.9em; color: #666; margin: 4px 0;">
                    <div>media condition: <span class="condition-tooltip media-condition">${this.escapeHtml(parts[0].trim())}</span></div>
                    <div>sleeve condition: <span class="condition-tooltip sleeve-condition">${this.escapeHtml(parts[1].trim())}</span></div>
                  </div>
                `;
              }
            }
          }

          // Format title like collection pages
          const formattedTitle = this.formatTitleLikeCollection(variant.title);

          variantsHTML += `
            <div class="group-variant-item" data-product-handle="${variant.handle}" style="display: flex; align-items: flex-start; gap: 12px; padding: 12px; margin-bottom: 8px;">
              <div class="variant-image-container js-product-link" data-product-url="/products/${variant.handle}" style="cursor: pointer;">
                ${imageHTML}
              </div>
              <div class="variant-details" style="flex: 1;">
                <div class="variant-title js-product-link" data-product-url="/products/${variant.handle}" style="font-weight: bold; margin-bottom: 4px; cursor: pointer; color: #007bff; text-decoration: underline;">${this.escapeHtml(formattedTitle)}</div>
                ${conditionHTML}
                <div class="variant-price" style="font-weight: bold; color: #333; margin: 4px 0;">${price}</div>
                <div class="variant-actions" style="display: flex; gap: 8px;">
                  <a href="/products/${variant.handle}" class="btn btn--primary btn--variant" style="padding: 6px 12px; font-size: 0.9em; border-radius: 0; background: #faa22a; color: #000; text-transform: uppercase; border: none;">
                    VIEW PRODUCT
                  </a>
                  ${isAvailable ? `<button class="btn btn--secondary btn--variant js-add-to-cart" data-variant-id="${variant.variants[0]?.id}" style="padding: 6px 12px; font-size: 0.9em; border-radius: 0; background: #92cfa6; color: #000; text-transform: uppercase; border: none;">ADD TO CART</button>` : ''}
                </div>
              </div>
            </div>
          `;
        });

        variantsContainer.innerHTML = variantsHTML;

        // Add click handlers for "Add to Cart" buttons
        variantsContainer.querySelectorAll('.js-add-to-cart').forEach((button) => {
          button.addEventListener('click', (e) => {
            e.preventDefault();
            this.addVariantToCart(button.dataset.variantId);
          });
        });

        // Add click handlers for product links (title and image)
        variantsContainer.querySelectorAll('.js-product-link').forEach((link) => {
          link.addEventListener('click', (e) => {
            e.preventDefault();
            const productUrl = link.dataset.productUrl;
            if (productUrl) {
              window.location.href = productUrl;
            }
          });
        });
      } catch (error) {
        console.error('Error loading group variants:', error);
        variantsContainer.innerHTML =
          '<div class="text-center p-4 text-red-500">Error loading variants</div>';
      }
    }

    /**
     * Gets condition information from metafields
     * @param {object} product - Product object with metafields
     * @returns {object} Condition with media and sleeve ratings
     */
    getConditionsFromMetafields(product) {
      if (product && product.metafields) {
        const mediaCondition = product.metafields.media_condition;
        const sleeveCondition = product.metafields.sleeve_condition;

        if (mediaCondition || sleeveCondition) {
          return {
            media: this.getFullConditionName(mediaCondition) || 'Unknown',
            sleeve: this.getFullConditionName(sleeveCondition) || 'Unknown',
            combined: `${mediaCondition || 'Unknown'}/${sleeveCondition || 'Unknown'}`,
          };
        }
      }

      return { media: '', sleeve: '', combined: '' };
    }

    /**
     * Converts condition abbreviation to full name
     * @param {string} condition - Condition abbreviation
     * @returns {string} Full condition name
     */
    getFullConditionName(condition) {
      if (!condition) {
        return '';
      }

      const conditionMap = {
        M: 'Mint (M)',
        NM: 'Near Mint (NM)',
        'NM or M-': 'Near Mint (NM or M-)',
        'NM Or M-': 'Near Mint (NM Or M-)',
        'VG+': 'Very Good Plus (VG+)',
        VG: 'Very Good (VG)',
        'G+': 'Good Plus (G+)',
        G: 'Good (G)',
        F: 'Fair (F)',
        P: 'Poor (P)',
      };

      return conditionMap[condition] || condition;
    }

    /**
     * Formats title like collection pages
     * @param {string} title - Product title
     * @returns {string} Formatted title
     */
    formatTitleLikeCollection(title) {
      let titleWithFormat = title
        .replace(/\(7\)/g, '(7")')
        .replace(/\(12\)/g, '(12")')
        .replace(/\(10\)/g, '(10")')
        .replace(/\(7" \)/g, '(7")')
        .replace(/\(12" \)/g, '(12")')
        .replace(/\(10" \)/g, '(10")');

      // Remove condition text from title
      const conditionPatterns = [
        / - \(Near Mint \(NM or M-\)\)/gi,
        / - \(Near Mint \(NM Or M-\)\)/gi,
        / \(Near Mint \(NM or M-\)\)/gi,
        /\(Near Mint \(NM or M-\)\)/gi,
        / - \(Very Good Plus \(VG\+\)\)/gi,
        / \(Very Good Plus \(VG\+\)\)/gi,
        /\(Very Good Plus \(VG\+\)\)/gi,
        / - \(Very Good \(VG\+\)\)/gi,
        / \(Very Good \(VG\+\)\)/gi,
        /\(Very Good \(VG\+\)\)/gi,
        / - \(Good Plus \(G\+\)\)/gi,
        / \(Good Plus \(G\+\)\)/gi,
        /\(Good Plus \(G\+\)\)/gi,
        / - \(Good \(G\+\)\)/gi,
        / \(Good \(G\+\)\)/gi,
        /\(Good \(G\+\)\)/gi,
        / - \(Fair \(F\)\)/gi,
        / \(Fair \(F\)\)/gi,
        /\(Fair \(F\)\)/gi,
        / - \(Poor \(P\)\)/gi,
        / \(Poor \(P\)\)/gi,
        /\(Poor \(P\)\)/gi,
        / - \(Mint \(M\)\)/gi,
        / \(Mint \(M\)\)/gi,
        /\(Mint \(M\)\)/gi,
      ];

      conditionPatterns.forEach((pattern) => {
        titleWithFormat = titleWithFormat.replace(pattern, '');
      });

      // Clean up
      titleWithFormat = titleWithFormat.replace(/\s+/g, ' ').trim();

      return titleWithFormat;
    }

    /**
     * Formats price in money format
     * @param {number} price - Price in cents
     * @returns {string} Formatted price
     */
    formatMoney(price) {
      const currency = window.Shopify?.currency?.active || 'GBP';
      return new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: currency,
      }).format(price / 100);
    }

    /**
     * Escapes HTML to prevent XSS
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    /**
     * Adds a variant to cart
     * @param {string} variantId - Variant ID to add to cart
     */
    async addVariantToCart(variantId) {
      try {
        const response = await fetch('/cart/add.js', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: variantId,
            quantity: 1,
          }),
        });

        if (response.ok) {
          // Update cart
          const cartDrawer = document.querySelector('cart-drawer');
          if (cartDrawer) {
            cartDrawer.refresh();
          }

          // Trigger cart update event
          document.dispatchEvent(new CustomEvent('cart:update', { bubbles: true }));

          // Close the group drawer
          const groupDrawer = document.querySelector('group-selection-drawer');
          if (groupDrawer) {
            groupDrawer.close();
          }
        } else {
          console.error('Failed to add to cart');
        }
      } catch (error) {
        console.error('Error adding to cart:', error);
      }
    }
  }

  // Initialize the handler when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.groupSelectionHandler = new GroupSelectionHandler();
    });
  } else {
    window.groupSelectionHandler = new GroupSelectionHandler();
  }
}
