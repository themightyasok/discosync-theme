# DiscoSync Theme

A modern Shopify theme for music/vinyl stores with advanced product grouping and search capabilities.

## Features

- **Product Grouping Engine**: Automatically groups products by Artist + Album + Format
- **Enhanced Predictive Search**: Tabbed search results with product type filtering
- **Storefront API Integration**: Handles large collections (5000+ products) efficiently
- **Music-Specific Metafields**: 26 custom metafields for music product data
- **Modern Build System**: Vite-powered development workflow

## Quick Start

### For Developers

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build the theme:**
   ```bash
   npm run build
   ```

3. **Watch for changes (development):**
   ```bash
   npm run watch
   ```

4. **Create distribution package:**
   ```bash
   npm run dist
   ```

### For End Users

1. Download the distribution package from releases
2. Upload to Shopify via Theme Editor or CLI
3. Configure Storefront API token in theme settings
4. Set up metafields (automatic or manual)

## Development

See [README_BUILD.md](./README_BUILD.md) for detailed build system documentation.

See [docs/](./docs/) for architecture and setup guides.

## Distribution

The distribution package includes:
- ✅ All compiled/bundled JavaScript files
- ✅ All compiled CSS files
- ✅ All Liquid templates, sections, snippets
- ✅ Theme configuration files
- ❌ No source files (SCSS, ES6 modules)
- ❌ No build tools or node_modules

## License

MIT
