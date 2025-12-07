# DiscoSync Theme - Build System

## Overview

This theme uses **Vite** as the build system to compile SCSS, bundle JavaScript, and optimize assets for production.

## Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0

## Installation

```bash
npm install
```

## Development

### Watch Mode (Auto-rebuild on changes)
```bash
npm run watch
```

This will watch for changes in:
- `assets/**/*.js` - JavaScript files
- `scss/**/*.scss` - SCSS stylesheets
- Automatically rebuild and output to `assets/` directory

### Development Server
```bash
npm run dev
```

Starts Vite dev server on port 3000 (for development and testing).

## Building for Production

```bash
npm run build
```

Or for optimized production build:
```bash
npm run build:prod
```

Build outputs:
- JavaScript: Minified and bundled in `assets/`
- SCSS: Compiled to CSS in `assets/`
- Source maps: Generated (can be disabled in `vite.config.js`)

## File Structure

```
assets/
  core/              # Core utilities (logger, constants, etc.)
  api/               # API clients (Storefront API)
  components/        # Web components (grouping, search, etc.)
  utils/             # Utility scripts (metafield setup, etc.)
  ...                # Other assets (existing Dawn files)

scss/
  base.scss          # Base styles entry point
  components.scss    # Components entry point
  _variables.scss    # SCSS variables
  _mixins.scss       # SCSS mixins
  components/        # Component-specific SCSS
```

## Code Quality

### Linting
```bash
npm run lint
```

Runs Shopify Theme Check for Liquid files.

### Formatting
```bash
npm run format
```

Auto-formats all code files.

### Format Check
```bash
npm run format:check
```

Checks code formatting without modifying files.

## Production Modules

The theme includes the following production-ready npm modules:

### Build Tools
- **vite** - Fast build tool and dev server
- **sass** - SCSS compilation
- **autoprefixer** - CSS vendor prefixing
- **postcss** - CSS processing
- **terser** - JavaScript minification

### Development Tools
- **@shopify/theme-check** - Shopify theme validation
- **prettier** - Code formatting
- **prettier-plugin-shopify-liquid** - Liquid template formatting

## Vite Configuration

Configuration is in `vite.config.js`. Key features:

- **Code Splitting**: Separates vendor code for better caching
- **SCSS Compilation**: Automatic compilation with autoprefixer
- **Minification**: Production builds are minified
- **Source Maps**: Generated for debugging (configurable)
- **Asset Optimization**: CSS and JS are optimized

## Integration with Shopify

The build system outputs directly to the `assets/` directory, which Shopify reads. 

**Important**: After building, deploy the theme to Shopify as normal. The built files in `assets/` will be uploaded.

## Workflow

1. **Development**: 
   - Make changes to `assets/**/*.js` or `scss/**/*.scss`
   - Run `npm run watch` to auto-rebuild
   - Test in Shopify theme preview

2. **Production**:
   - Run `npm run build:prod`
   - Commit built files (if tracking in git)
   - Deploy to Shopify

## Troubleshooting

### Build Errors
- Check Node.js version: `node --version` (must be >= 18)
- Clear cache: `npm run clean` then `npm install`
- Check `vite.config.js` for configuration issues

### SCSS Not Compiling
- Ensure SCSS files are in `scss/` directory
- Check import paths in SCSS files
- Verify `sass` package is installed

### JavaScript Not Bundling
- Check file paths in `vite.config.js` entrypoints
- Verify imports are correct (ES module syntax)
- Check browser console for runtime errors

## Next Steps

1. Run `npm install` to install dependencies
2. Run `npm run build` to create initial build
3. Test in Shopify theme preview
4. Set up your editor with Prettier for auto-formatting

