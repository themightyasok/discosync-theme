# DiscoSync Theme Documentation

## Overview

DiscoSync is a Shopify theme based on Dawn, enhanced with music-specific features including product grouping, enhanced search, and comprehensive metafield support.

## Documentation Index

### Core Features

- **[Storefront API Grouping Engine](./STOREFRONT_API_GROUPING_ENGINE.md)** - Complete guide to the product grouping system
- **[Metafields Setup](./METAFIELDS_SETUP.md)** - Comprehensive metafield documentation and setup guide

### Quick Start

1. **Install Theme** - Upload to Shopify
2. **Configure Storefront API Token** - Set in `layout/theme.liquid`
3. **Set Up Metafields** - Automatic via app API, or manual creation
4. **Configure App API** (optional) - For automatic metafield creation

### Key Features

- **Product Grouping** - Groups products by Artist + Album + Format
- **Enhanced Search** - Predictive search with tabs and product type filtering
- **Storefront API Integration** - Handles collections up to 5,000 products
- **Metafield Support** - 26 custom metafields for music products

### Architecture

- **Custom Elements** - Web Components for modular functionality
- **Storefront API** - GraphQL client for product fetching
- **Section Rendering API** - Server-side rendering for product cards
- **Progressive Loading** - Batched fetching and rendering for performance

### For Developers

See [.cursorrules](../.cursorrules) for development guidelines and coding standards.

