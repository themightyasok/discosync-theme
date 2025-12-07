/* global debounce */

if (!customElements.get('predictive-search')) {
  class PredictiveSearch extends HTMLElement {
    constructor() {
      super();
      this.cachedResults = {};
      // Support both Dawn modal structure and enhanced inline structure
      this.input =
        this.querySelector('.js-search-input') ||
        this.querySelector('.search__input.field__input') ||
        this.querySelector('input[type="search"]');
      this.productTypeSelect = this.querySelector('.js-search-product-types');
      this.productTypeInput = document.getElementById('product_type_input');
      this.resetBtn =
        this.querySelector('.js-search-reset') || this.querySelector('.reset__button');
      // Support both structures for results container
      this.results =
        this.querySelector('.js-search-results') ||
        this.querySelector('.predictive-search.predictive-search--header') ||
        this.querySelector('[data-predictive-search]');
      this.overlay =
        this.querySelector('.js-search-overlay') ||
        this.closest('details-modal')?.querySelector('.modal-overlay');
      this.statusEl =
        this.querySelector('.js-search-status') || this.querySelector('.predictive-search-status');
      this.loadingText = this.getAttribute('data-loading-text');
      this.isModalMode = this.closest('details-modal') !== null;
      this.addListeners();
    }

    /**
     * Triggers when the web component is removed from the DOMsss
     */
    disconnectedCallback() {
      this.close();
    }

    addListeners() {
      this.input.addEventListener('focus', this.handleFocus.bind(this));
      this.input.addEventListener('input', debounce(this.handleInput.bind(this)));
      if (this.productTypeSelect) {
        // Restore saved product type selection from localStorage
        const savedProductType = localStorage.getItem('search_product_type');
        if (savedProductType && savedProductType !== '') {
          this.productTypeInput.value = savedProductType;
          // Set the custom-select to show the saved value
          setTimeout(() => {
            // Find option by iterating through options (more reliable than CSS selector with special chars)
            const options = this.productTypeSelect.querySelectorAll('.js-option');
            let savedOption = null;
            options.forEach((option) => {
              if (option.dataset.value === savedProductType) {
                savedOption = option;
              }
            });
            if (savedOption && this.productTypeSelect.selectOption) {
              this.productTypeSelect.selectOption(savedOption);
            }
          }, 100);
        }
        this.productTypeSelect.addEventListener('change', this.handleProductTypeChange.bind(this));
      }
      this.querySelector('.search').addEventListener('submit', this.handleSubmit.bind(this));
    }

    /**
     * Gets the value of the search input field.
     * @returns {string}
     */
    getQuery() {
      return this.input.value.trim();
    }

    /**
     * Handles search form submit.
     * @param {object} evt - Event object.
     */
    handleSubmit(evt) {
      if (
        !this.getQuery().length ||
        this.querySelector('.predictive-search__item[aria-selected="true"]:not(.js-submit)')
      ) {
        evt.preventDefault();
      }
    }

    /**
     * Handles 'input' events on the search field.
     */
    handleInput() {
      // autocomplete=off prevents browser from restoring value after using back button in Safari
      this.input.setAttribute('value', this.input.value);

      const searchTerm = this.getQuery();

      if (!searchTerm.length) {
        this.close();
        return;
      }

      this.getResults(searchTerm);
    }

    /**
     * Handles a change of product type
     * @param {object} evt - Event object.
     */
    handleProductTypeChange(evt) {
      this.productTypeInput.value = evt.detail.selectedValue;
      // Save the selection to localStorage so it persists across pages
      localStorage.setItem('search_product_type', evt.detail.selectedValue);
      const query = this.getQuery();
      if (query.length > 0) {
        this.getResults(query);
      }
    }

    /**
     * Handles 'focus' events on the search field.
     */
    handleFocus() {
      const searchTerm = this.getQuery();
      if (!searchTerm.length) {
        return;
      }

      if (this.getAttribute('results') === 'true') {
        this.open();
      } else {
        this.getResults(searchTerm);
      }
    }

    /**
     * Handles 'keydown' events on the custom element.
     * @param {object} evt - Event object.
     */
    handleKeydown(evt) {
      // Let tabs script handle keydown events on the tab buttons.
      if (evt.target.matches('.tablist__tab')) {
        return;
      }

      switch (evt.key) {
        case 'ArrowUp':
        case 'ArrowDown':
          evt.preventDefault();

          if (this.hasAttribute('open')) {
            this.handleResultsNav(evt.key);
          }
          break;

        case 'Enter':
          this.selectOption();
          break;

        case 'Escape':
          this.close();
          break;

        // no default
      }
    }

    /**
     * Handles 'keyup' events on the custom element.
     */
    handleKeyup() {
      // If search field is empty after key press, close the results.
      if (!this.getQuery().length) {
        this.close();
      }
    }

    /**
     * Handles keyboard navigation of the results.
     * @param {string} key - Key pressed.
     */
    handleResultsNav(key) {
      const selectedResult = this.querySelector(
        '[role="tabpanel"]:not([hidden]) [aria-selected="true"]',
      );
      const allResults = this.querySelectorAll(
        '[role="tabpanel"]:not([hidden]) .predictive-search__item',
      );
      let resultToSelect = allResults[0];

      if (key === 'ArrowUp') {
        if (!selectedResult) {
          return;
        }

        // Select the next result up or the last one if we've reached the top of the list.
        resultToSelect = selectedResult.previousElementSibling || allResults[allResults.length - 1];
      } else if (key === 'ArrowDown') {
        if (selectedResult) {
          // Select the next result down or the first one if we've reached the bottom of the list.
          resultToSelect = selectedResult.nextElementSibling || allResults[0];
        }
      }

      this.statusEl.textContent = '';

      if (resultToSelect) {
        // If the selected item didn't change, do nothing.
        if (resultToSelect === selectedResult) {
          return;
        }

        resultToSelect.setAttribute('aria-selected', 'true');
        if (selectedResult) {
          selectedResult.setAttribute('aria-selected', 'false');
        }

        this.setLiveRegionText(resultToSelect.textContent);
        this.input.setAttribute('aria-activedescendant', resultToSelect.id);
      }
    }

    /**
     * Selects a result
     */
    selectOption() {
      const selectedResult = this.querySelector('[aria-selected="true"] > .js-search-link');
      if (selectedResult) {
        selectedResult.click();
      }
    }

    /**
     * Gets the results for a search term.
     * @param {string} searchTerm - Search query.
     */
    async getResults(searchTerm) {
      this.setLiveRegionLoadingState();

      let searchFields = 'title,product_type,variants.title,vendor';
      // Check for theme settings with fallbacks
      const pSearchIncludeSkus =
        (window.theme && window.theme.settings && window.theme.settings.pSearchIncludeSkus) ||
        false;
      const pSearchIncludeTags =
        (window.theme && window.theme.settings && window.theme.settings.pSearchIncludeTags) ||
        false;
      const pSearchLimit =
        (window.theme && window.theme.settings && window.theme.settings.pSearchLimit) || 4;
      const pSearchLimitScope =
        (window.theme && window.theme.settings && window.theme.settings.pSearchLimitScope) ||
        'each';

      if (pSearchIncludeSkus) {
        searchFields += ',variants.sku';
      }
      if (pSearchIncludeTags) {
        searchFields += ',tag';
      }

      let searchParams = '';
      if (this.productTypeInput && this.productTypeInput.value !== '') {
        searchParams = `q=product_type:${encodeURIComponent(this.productTypeInput.value)} AND ${encodeURIComponent(searchTerm)}`;
      } else {
        searchParams = `q=${encodeURIComponent(searchTerm)}`;
      }

      searchParams += `&${encodeURIComponent('resources[limit]')}=${pSearchLimit}`;
      searchParams += `&${encodeURIComponent('resources[limit_scope]')}=${pSearchLimitScope}`;
      searchParams += `&${encodeURIComponent('resources[options][fields]')}=${searchFields}`;
      searchParams += '&section_id=predictive-search';

      const queryKey = searchParams.replace(' ', '-').toLowerCase();
      if (this.cachedResults[queryKey]) {
        this.renderResults(this.cachedResults[queryKey]);
        return;
      }

      try {
        // Use Dawn's routes object format
        const predictiveSearchUrl =
          (window.routes && window.routes.predictive_search_url) || '/search/suggest';
        const response = await fetch(`${predictiveSearchUrl}?${searchParams}`);
        if (!response.ok) {
          throw new Error(response.status);
        }

        const tmpl = document.createElement('template');
        tmpl.innerHTML = await response.text();

        const resultsEl = tmpl.content.querySelector('#shopify-section-predictive-search');
        const resultsMarkup = resultsEl.innerHTML.replace(/psearch/g, this.input.id);

        this.cachedResults[queryKey] = resultsMarkup;
        this.renderResults(resultsMarkup);
      } catch (error) {
        this.close();
        throw error;
      }
    }

    /**
     * Sets the live region loading state.
     */
    setLiveRegionLoadingState() {
      this.setLiveRegionText(this.loadingText);
    }

    /**
     * Sets the live region text.
     * @param {string} statusText - Status text.
     */
    setLiveRegionText(statusText) {
      if (this.statusEl) {
        this.statusEl.setAttribute('aria-hidden', 'false');
        this.statusEl.textContent = statusText;

        setTimeout(() => {
          this.statusEl.setAttribute('aria-hidden', 'true');
        }, 1000);
      }
    }

    /**
     * Renders the results markup.
     * @param {string} resultsMarkup - Results markup.
     */
    renderResults(resultsMarkup) {
      this.results.innerHTML = resultsMarkup;
      this.setAttribute('results', true);
      this.open();
    }

    /**
     * Opens the results listbox.
     */
    open() {
      if (this.overlay) {
        this.overlay.classList.add('is-visible');
      }
      if (this.getQuery().length && this.resetBtn) {
        this.resetBtn.hidden = false;
      }
      this.input.setAttribute('aria-expanded', 'true');
      this.setAttribute('open', '');
      document.body.classList.add('overlay-predictive-search');

      // Add event handlers (so the bound event listeners can be removed).
      this.keydownHandler = this.keydownHandler || this.handleKeydown.bind(this);
      this.keyupHandler = this.keyupHandler || this.handleKeyup.bind(this);
      this.resetBtnClickHandler = this.resetBtnClickHandler || this.close.bind(this);
      this.overlayClickHandler = this.overlayClickHandler || this.close.bind(this);

      // Add event listeners (for while results are open).
      this.addEventListener('keydown', this.keydownHandler);
      this.addEventListener('keyup', this.keyupHandler);
      if (this.resetBtn) {
        this.resetBtn.addEventListener('click', this.resetBtnClickHandler);
      }
      if (this.overlay) {
        this.overlay.addEventListener('click', this.overlayClickHandler);
      }
    }

    /**
     * Closes the results listbox.
     * @param {object} evt - Event object.
     */
    close(evt) {
      // If reset button was clicked, empty the input field.
      if (evt && this.resetBtn && evt.target === this.resetBtn) {
        this.input.value = '';
        this.removeAttribute('results');
        this.input.focus();
      }

      // Deselect the selected result (if there is one).
      const selected = this.querySelector('.predictive-search__item[aria-selected="true"]');
      if (selected) {
        selected.setAttribute('aria-selected', 'false');
      }

      this.removeAttribute('open');
      if (this.resetBtn) {
        this.resetBtn.hidden = true;
      }
      if (this.overlay) {
        this.overlay.classList.remove('is-visible');
      }
      this.input.setAttribute('aria-activedescendant', '');
      this.input.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('overlay-predictive-search');

      // Remove event listeners added on search results opening.
      this.removeEventListener('keydown', this.keydownHandler);
      if (this.resetBtn) {
        this.resetBtn.removeEventListener('click', this.resetBtnClickHandler);
      }
      if (this.overlay) {
        this.overlay.removeEventListener('click', this.overlayClickHandler);
      }
    }
  }

  customElements.define('predictive-search', PredictiveSearch);
}
