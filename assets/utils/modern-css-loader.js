/**
 * Modern CSS Loader
 * Replaces inline onload handlers with event listeners
 */

(function () {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initModernCSSLoader);
  } else {
    initModernCSSLoader();
  }

  function initModernCSSLoader() {
    // Find all preload links that need conversion
    const preloadLinks = document.querySelectorAll('link[rel="preload"][as="style"]');

    preloadLinks.forEach((link) => {
      // Skip if already converted
      if (link.getAttribute('data-converted')) {
        return;
      }

      link.setAttribute('data-converted', 'true');

      // Set up event listener for load
      link.addEventListener('load', function () {
        this.onload = null;
        this.rel = 'stylesheet';
      });

      // Set up event listener for error
      link.addEventListener('error', function () {
        // Fallback: try loading as stylesheet anyway
        const fallbackLink = document.createElement('link');
        fallbackLink.rel = 'stylesheet';
        fallbackLink.href = this.href;
        this.parentNode.insertBefore(fallbackLink, this.nextSibling);
      });
    });

    // Also handle any remaining inline onload handlers
    const linksWithOnload = document.querySelectorAll('link[onload]');
    linksWithOnload.forEach((link) => {
      const onloadHandler = link.getAttribute('onload');
      if (onloadHandler && onloadHandler.includes('media')) {
        // Remove inline handler
        link.removeAttribute('onload');

        // Convert to event listener
        link.addEventListener('load', function () {
          this.media = 'all';
        });
      }
    });
  }
})();
