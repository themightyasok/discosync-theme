/**
 * Cumulative Layout Shift (CLS) Prevention
 * Reserves space for images and dynamic content to prevent layout shifts
 */

import themeLogger from './logger.js';

class CLSPrevention {
  constructor() {
    this.observedImages = new Set();
    this.init();
  }

  init() {
    // Reserve space for images
    this.observeImages();
    
    // Reserve space for dynamic content
    this.reserveSpaceForDynamicContent();
  }

  /**
   * Observe images and reserve space to prevent CLS
   */
  observeImages() {
    if (!('IntersectionObserver' in window)) return;

    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          
          // Ensure image has width/height attributes
          if (!img.hasAttribute('width') || !img.hasAttribute('height')) {
            this.addAspectRatio(img);
          }
          
          imageObserver.unobserve(img);
        }
      });
    }, {
      rootMargin: '50px',
    });

    // Observe all images
    document.querySelectorAll('img[loading="lazy"]').forEach(img => {
      imageObserver.observe(img);
    });

    // Watch for dynamically added images
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            if (node.tagName === 'IMG') {
              if (node.hasAttribute('loading') && node.getAttribute('loading') === 'lazy') {
                imageObserver.observe(node);
              }
            } else {
              node.querySelectorAll('img[loading="lazy"]').forEach(img => {
                imageObserver.observe(img);
              });
            }
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * Add aspect ratio to image for CLS prevention
   */
  addAspectRatio(img) {
    if (img.hasAttribute('width') && img.hasAttribute('height')) {
      const width = parseInt(img.getAttribute('width'));
      const height = parseInt(img.getAttribute('height'));
      
      if (width && height) {
        const aspectRatio = width / height;
        img.style.aspectRatio = `${width} / ${height}`;
        
        // Add placeholder to reserve space
        if (!img.closest('.aspect-ratio-wrapper')) {
          const wrapper = document.createElement('div');
          wrapper.className = 'aspect-ratio-wrapper';
          wrapper.style.aspectRatio = `${width} / ${height}`;
          wrapper.style.width = '100%';
          
          img.parentNode.insertBefore(wrapper, img);
          wrapper.appendChild(img);
        }
      }
    } else if (img.complete && img.naturalWidth && img.naturalHeight) {
      // Image already loaded
      const aspectRatio = img.naturalWidth / img.naturalHeight;
      img.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
    }
  }

  /**
   * Reserve space for dynamic content
   */
  reserveSpaceForDynamicContent() {
    // Reserve space for product grids that will be populated
    const productGrids = document.querySelectorAll('[data-product-grid], #product-grid');
    productGrids.forEach(grid => {
      if (grid.children.length === 0) {
        // Reserve minimum height
        grid.style.minHeight = '400px';
        grid.setAttribute('aria-busy', 'true');
        
        // Watch for content
        const observer = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            if (mutation.addedNodes.length > 0) {
              grid.style.minHeight = '';
              grid.removeAttribute('aria-busy');
              observer.disconnect();
            }
          });
        });
        
        observer.observe(grid, { childList: true });
        
        // Timeout fallback
        setTimeout(() => {
          grid.style.minHeight = '';
          grid.removeAttribute('aria-busy');
        }, 5000);
      }
    });
  }

  /**
   * Reserve space for specific element
   */
  reserveSpace(element, width, height) {
    if (!element) return;
    
    const aspectRatio = width / height;
    element.style.aspectRatio = `${width} / ${height}`;
    element.setAttribute('data-cls-reserved', 'true');
  }
}

// Initialize and export
const clsPrevention = new CLSPrevention();
window.clsPrevention = clsPrevention;

export default clsPrevention;

