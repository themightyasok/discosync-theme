import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readdirSync } from 'fs';

/**
 * Vite Configuration for DiscoSync Theme
 * 
 * Builds and optimizes:
 * - JavaScript files (bundled as IIFE for browser compatibility)
 * - SCSS files (compilation, autoprefixer, minification)
 * - Asset optimization
 */

function getEntryPoints() {
  const entries = {};
  
  // Core bundle - all core utilities bundled together
  entries['core-bundle'] = resolve(__dirname, 'assets/core/index.js');
  
  // API bundle - depends on core
  entries['api-bundle'] = resolve(__dirname, 'assets/api/index.js');
  
  // Component bundles - each component bundled with its dependencies
  entries['components/collection-grouping-enhancer-bundle'] = resolve(__dirname, 'assets/components/collection-grouping-enhancer.js');
  entries['components/predictive-search-bundle'] = resolve(__dirname, 'assets/components/predictive-search.js');
  entries['components/more-from-enhancer-bundle'] = resolve(__dirname, 'assets/components/more-from-enhancer.js');
  
  // Utility bundles
  entries['utils/metafield-setup-bundle'] = resolve(__dirname, 'assets/utils/metafield-setup.js');
  entries['utils/modern-css-loader-bundle'] = resolve(__dirname, 'assets/utils/modern-css-loader.js');
  
  // SCSS entry points
  try {
    const scssFiles = readdirSync('scss');
    scssFiles.forEach(file => {
      if (file.endsWith('.scss') && !file.startsWith('_')) {
        const name = file.replace('.scss', '');
        entries[`scss/${name}`] = resolve(__dirname, 'scss', file);
      }
    });
  } catch (e) {
    // SCSS directory doesn't exist yet
  }
  
  return entries;
}

export default defineConfig({
  build: {
    outDir: 'assets',
    emptyOutDir: false, // Don't empty - we're building into assets/
    manifest: false,
    sourcemap: false, // Set to true for dev, false for production
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // Keep console for logger
        drop_debugger: true,
      },
      format: {
        comments: false,
      },
    },
    rollupOptions: {
      input: getEntryPoints(),
      output: {
        format: 'iife', // Immediately Invoked Function Expression - works in all browsers
        // Preserve directory structure for components/utils
        entryFileNames: (chunkInfo) => {
          const name = chunkInfo.name;
          
          // SCSS output as CSS
          if (name.includes('scss/')) {
            return '[name].css';
          }
          
          // Component and utility bundles in subdirectories
          if (name.includes('/')) {
            return '[name].js';
          }
          
          // Root level bundles
          return '[name].js';
        },
        chunkFileNames: 'chunks/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name.endsWith('.css')) {
            return '[name][extname]';
          }
          return '[name][extname]';
        },
        // Expose globals for IIFE
        globals: {
          // Core utilities exposed on window
        },
        // Generate IIFE wrapper that exposes globals
        name: 'DiscoSyncTheme',
      },
      external: [],
    },
  },

  css: {
    preprocessorOptions: {
      scss: {
        outputStyle: 'compressed',
        includePaths: ['node_modules'],
      },
    },
    postcss: {
      plugins: [
        require('autoprefixer')({
          overrideBrowserslist: [
            '> 1%',
            'last 2 versions',
            'not dead',
          ],
        }),
      ],
    },
  },

  resolve: {
    alias: {
      '@': resolve(__dirname, './assets'),
      '@core': resolve(__dirname, './assets/core'),
      '@api': resolve(__dirname, './assets/api'),
      '@components': resolve(__dirname, './assets/components'),
      '@utils': resolve(__dirname, './assets/utils'),
    },
  },

  server: {
    port: 3000,
    strictPort: false,
  },
});
