# Storefront API Grouping Engine Documentation

## Overview

The Storefront API Grouping Engine automatically groups products in collections by **Artist + Album + Format**, displaying them as grouped cards with a "X copies available" indicator. This system fetches all products via the Storefront API, groups them client-side, and renders them using Shopify's Section Rendering API for perfect server-side rendering.

## Architecture

### Key Components

1. **`StorefrontAPIClient`** (`assets/storefront-api-client.js`)
   - GraphQL client for Storefront API
   - Handles product fetching, filtering, and search
   - Manages pagination for large collections

2. **`CollectionGroupingEnhancer`** (`assets/collection-grouping-enhancer.js`)
   - Main grouping engine
   - Fetches all products, groups them, and renders cards
   - Handles progressive loading and filter updates

3. **Section Rendering API** (`sections/product-group-card-renderer.liquid`)
   - Server-side rendering endpoint
   - Renders individual product cards with Liquid
   - Ensures perfect match with theme styling

4. **Product Group Card** (`snippets/product-group-card.liquid`)
   - Individual product card with grouping indicators
   - Handles single products and grouped products
   - Shows "from" pricing for groups

## How It Works

### Step 1: Initialization

When a collection or search page loads:

```javascript
<collection-grouping-enhancer
  data-section-id="{{ section.id }}"
  data-collection-handle="{{ collection.handle }}"
  data-search-terms="{{ search.terms }}"
  data-card-size="medium"
  data-enable-quick-add="true"
>
</collection-grouping-enhancer>
```

The custom element initializes and:
- Detects if it's a collection or search page
- Creates a Storefront API client
- Sets up filter update listeners
- Hides the original Liquid-rendered grid

### Step 2: Fetching Products

The engine fetches ALL products in the collection via Storefront API GraphQL:

```graphql
query GetCollection($handle: String!, $first: Int!, $after: String) {
  collection(handle: $handle) {
    products(first: $first, after: $after) {
      edges {
        node {
          id
          handle
          title
          productType
          priceRange {
            minVariantPrice { amount, currencyCode }
          }
          metafields: {
            artist: metafield(namespace: "custom", key: "artist") { value }
            title_metafield: metafield(namespace: "custom", key: "title") { value }
            format: metafield(namespace: "custom", key: "format") { value }
            media_condition: ...
            sleeve_condition: ...
            style_genre: ...
          }
        }
      }
      pageInfo { hasNextPage, endCursor }
    }
  }
}
```

**Progressive Loading:**
- Fetches 250 products per request (configurable)
- Continues until all products are loaded (up to 5,000 limit)
- Stores all products in memory for grouping

### Step 3: Product Grouping

Products are grouped by a normalized key: `artist|album|format`

**Normalization Process:**
1. Extract artist from `custom.artist` metafield (or parse from title)
2. Extract album from `custom.title` metafield (or parse from title)
3. Extract format from `custom.format` metafield (or productType)
4. Normalize each: lowercase, trim, remove special characters
5. Create key: `${normalizedArtist}|${normalizedAlbum}|${normalizedFormat}`

**Group Detection:**
- Products with the same key are grouped together
- First product in group is the "main" product
- Other products are variants/grouped items
- Groups with 2+ products show "X copies available" badge

### Step 4: Rendering

For each product/group:

1. **Call Section Rendering API:**
   ```javascript
   POST /?section_id=product-group-card-renderer
   {
     main_product_handle: "product-handle",
     variant_handles: ["variant1", "variant2"],
     group_formats: ["Vinyl LP", "CD"],
     ...
   }
   ```

2. **Server Renders Card:**
   - `product-group-card-renderer.liquid` looks up products
   - Renders using `product-group-card.liquid` snippet
   - Returns HTML string

3. **Insert into DOM:**
   - Extracts card HTML from response
   - Inserts into grid
   - Reinitializes components (carousels, animations)

**Progressive Rendering:**
- Renders 10 cards at a time
- Shows loading states between batches
- Maintains scroll position
- Updates progress indicator

### Step 5: Filter Handling

When filters are applied:

1. **Listen for Events:**
   - Listens to `on:facet-filters:updated` event
   - Hides grid immediately to prevent flash
   - Debounces rapid filter changes (300ms)

2. **Re-fetch with Filters:**
   - Parses filter parameters from URL
   - Builds GraphQL filter input
   - Fetches filtered products
   - Re-groups and re-renders

3. **URL Management:**
   - Updates URL with filter parameters
   - Maintains browser history
   - Supports deep linking

## Required Metafields

The grouping engine requires these metafields:

### Core (Required for Grouping)
- **`custom.artist`** - Artist name (used for grouping)
- **`custom.title`** - Album title (used for grouping)
- **`custom.format`** - Format type (used for grouping)

### Optional (For Filtering)
- `custom.media_condition` - Media condition
- `custom.sleeve_condition` - Sleeve condition
- `custom.computed_style_genre` - Style/genre (list)
- `custom.computed_master_label` - Record label

See `config/metafields.json` for complete list.

## Configuration

### Theme Settings

No theme settings required - works automatically on:
- Collection pages (`main-collection-product-grid.liquid`)
- Search results pages (`main-search.liquid`)

### Data Attributes

```liquid
<collection-grouping-enhancer
  data-section-id="{{ section.id }}"           <!-- Required -->
  data-collection-handle="{{ collection.handle }}"  <!-- Collection pages -->
  data-search-terms="{{ search.terms }}"       <!-- Search pages -->
  data-card-size="medium"                      <!-- Optional: small/medium/large -->
  data-enable-quick-add="true"                 <!-- Optional: enable quick add -->
  data-card-contain="false"                    <!-- Optional: contained cards -->
  data-show-dividers="true"                    <!-- Optional: show dividers -->
>
</collection-grouping-enhancer>
```

### Storefront API Token

Required in `layout/theme.liquid`:

```liquid
<meta name="shopify-storefront-api-token" content="YOUR_STOREFRONT_API_TOKEN">
```

Get token from: **Shopify Admin > Apps > Develop apps > Storefront API**

## Performance Considerations

### Limits
- Maximum 5,000 products per collection (configurable)
- Progressive loading in batches of 250 products
- Progressive rendering in batches of 10 cards

### Optimization
- Client-side caching of fetched products
- Debounced filter updates (300ms)
- Lazy loading of images
- Efficient DOM manipulation

### Metrics
The engine tracks:
- Total products fetched
- Products grouped
- Render time
- API call count

Enable debug mode by adding `?debug=1` to URL.

## Troubleshooting

### Products Not Grouping

1. **Check Metafields:**
   - Verify `custom.artist`, `custom.title`, `custom.format` exist
   - Ensure products have values in these metafields
   - Check browser console for metafield errors

2. **Check Storefront API Token:**
   - Verify token is set in `theme.liquid`
   - Check browser console for authentication errors
   - Ensure token has `unauthenticated_read_products` scope

3. **Check Collection Handle:**
   - Verify `data-collection-handle` attribute is correct
   - Check network tab for GraphQL query errors

### Slow Performance

1. **Large Collections:**
   - Consider limiting collection size
   - Check if products have too many variants
   - Verify Storefront API rate limits

2. **Network Issues:**
   - Check Storefront API response times
   - Verify pagination is working correctly
   - Check for excessive API calls

### Filtering Not Working

1. **Check Filter Parameters:**
   - Verify filter parameters in URL
   - Check GraphQL filter syntax
   - Ensure metafields are filterable in Storefront API

2. **Check Event Listeners:**
   - Verify `on:facet-filters:updated` event is firing
   - Check browser console for errors
   - Ensure filter updates are debounced

## Debug Mode

Enable debug mode to see detailed logging:

1. Add `?debug=1` to URL
2. Check browser console for:
   - Product fetching progress
   - Grouping results
   - Render progress
   - Filter updates

Debug panel shows:
- Total products
- Groups created
- Render status
- API call count
- Performance metrics

## API Reference

### StorefrontAPIClient

#### `getCollection(handle, filters, cursor, limit)`
Fetches products from a collection.

**Parameters:**
- `handle` (string) - Collection handle
- `filters` (array) - GraphQL filter objects
- `cursor` (string) - Pagination cursor
- `limit` (number) - Products per page (default: 250)

**Returns:** Promise resolving to collection data

#### `searchProducts(query, cursor, limit)`
Searches products using Storefront API.

**Parameters:**
- `query` (string) - Search query
- `cursor` (string) - Pagination cursor
- `limit` (number) - Products per page (default: 250)

**Returns:** Promise resolving to search results

### CollectionGroupingEnhancer

#### `enhance()`
Main method that fetches, groups, and renders products.

**Returns:** Promise

#### `handleFilterUpdate(event)`
Handles filter updates and re-renders products.

**Parameters:**
- `event` (CustomEvent) - Filter update event

**Returns:** Promise

## Related Files

- `assets/storefront-api-client.js` - API client
- `assets/collection-grouping-enhancer.js` - Main engine
- `sections/product-group-card-renderer.liquid` - Rendering endpoint
- `snippets/product-group-card.liquid` - Card template
- `sections/main-collection-product-grid.liquid` - Collection integration
- `sections/main-search.liquid` - Search integration

