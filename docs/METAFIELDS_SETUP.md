# Metafields Setup Documentation

## Overview

This theme requires 26 custom metafields to function properly. These metafields enable product grouping, enhanced search, filtering, and display of music-specific product information.

## Automatic Creation

The theme automatically creates all required metafields when activated (if app API is configured).

### Requirements

1. **DiscoSync App Installed** - The app provides the API endpoint for metafield creation
2. **API Credentials Configured** - Set in Theme Settings > DiscoSync App Integration:
   - App API URL
   - Store ID
   - API Key

### How It Works

1. On first page load, a script in `theme.liquid` runs
2. Checks if metafields have been created (uses localStorage)
3. If not created, calls app API: `POST /api/metafields/:storeId/bulk`
4. App creates all 26 metafield definitions via Shopify Admin API
5. Success is stored in localStorage to prevent duplicate attempts

See `config/metafields.json` for the complete metafield definitions.

## Manual Creation

If automatic creation fails or app is not available, create metafields manually:

### Via Shopify Admin

1. Go to **Settings > Custom data > Products**
2. Click **Add definition** for each metafield
3. Use the namespace `custom` and keys from the list below
4. Set the correct type (see type reference below)
5. Add descriptions as needed

### Via Shopify Admin API

Use GraphQL mutation:

```graphql
mutation CreateMetafieldDefinition($definition: MetafieldDefinitionInput!) {
  metafieldDefinitionCreate(definition: $definition) {
    metafieldDefinition {
      id
      name
      key
      namespace
      type {
        name
      }
    }
    userErrors {
      field
      message
    }
  }
}
```

## Complete Metafield List

### Core Grouping Fields (Required)

| Key | Name | Type | Required | Description |
|-----|------|------|----------|-------------|
| `artist` | Artist | `single_line_text_field` | ✅ Yes | Artist/performer name for grouping |
| `title` | Album Title | `single_line_text_field` | ✅ Yes | Album/release title for grouping |
| `format` | Format | `single_line_text_field` | ✅ Yes | Physical format (Vinyl LP, CD, etc.) |

### Condition Fields (Optional)

| Key | Name | Type | Required | Description |
|-----|------|------|----------|-------------|
| `media_condition` | Media Condition | `single_line_text_field` | No | Condition of media/record |
| `sleeve_condition` | Sleeve Condition | `single_line_text_field` | No | Condition of sleeve/cover |
| `condition` | Condition | `single_line_text_field` | No | General condition rating |
| `media_rating` | Media Rating | `single_line_text_field` | No | Media rating (variant-level) |
| `cover_rating` | Cover Rating | `single_line_text_field` | No | Cover rating (variant-level) |

### Genre & Style Fields (Optional)

| Key | Name | Type | Required | Description |
|-----|------|------|----------|-------------|
| `style_genre` | Style/Genre | `single_line_text_field` | No | Legacy genre field |
| `computed_style_genre` | Computed Style/Genre | `list.single_line_text_field` | No | Genre list for filtering |

### Label & Catalog Fields (Optional)

| Key | Name | Type | Required | Description |
|-----|------|------|----------|-------------|
| `computed_master_label` | Master Label | `single_line_text_field` | No | Primary record label |
| `label` | Label | `single_line_text_field` | No | Alternative label field |
| `computed_label` | Computed Label | `single_line_text_field` | No | Computed label name |
| `computed_other_labels` | Computed Other Labels | `list.single_line_text_field` | No | List of other labels |
| `catno` | Catalog Number | `single_line_text_field` | No | Catalog number |
| `catalogue_number` | Catalogue Number | `single_line_text_field` | No | Alternative catalog field |

### Release Information (Optional)

| Key | Name | Type | Required | Description |
|-----|------|------|----------|-------------|
| `released` | Release Date | `date` | No | Release date |
| `computed_release_year` | Computed Release Year | `single_line_text_field` | No | Release year extracted |

### Additional Fields (Optional)

| Key | Name | Type | Required | Description |
|-----|------|------|----------|-------------|
| `album` | Album | `single_line_text_field` | No | Album name (alternative to title) |
| `computed_formats` | Computed Formats | `list.single_line_text_field` | No | List of all formats available |
| `computed_other_artists` | Computed Other Artists | `list.single_line_text_field` | No | List of other artists |
| `collectibility_score` | Collectibility Score | `single_line_text_field` | No | Rarity/collectibility score |
| `enhanced_keywords` | Enhanced Keywords | `single_line_text_field` | No | Enhanced search keywords |
| `location` | Location | `single_line_text_field` | No | Physical storage location |
| `has_360_view` | Has 360 View | `boolean` | No | Whether 360° view available |
| `tracklist` | Tracklist | `multi_line_text_field` | No | Track listing |

## Metafield Types Reference

### Single Line Text Field
- **Type:** `single_line_text_field`
- **Max Length:** Varies (see validation in `config/metafields.json`)
- **Usage:** Artist names, titles, formats, conditions

### Multi Line Text Field
- **Type:** `multi_line_text_field`
- **Usage:** Track listings, descriptions

### List Single Line Text Field
- **Type:** `list.single_line_text_field`
- **Usage:** Arrays of strings (genres, formats, artists, labels)
- **Liquid Usage:** `for item in metafield.value`

### Date Field
- **Type:** `date`
- **Format:** YYYY-MM-DD
- **Usage:** Release dates

### Boolean Field
- **Type:** `boolean`
- **Values:** `true` or `false`
- **Usage:** Feature flags (has_360_view)

## Validation Rules

Some metafields have validation rules (max length):

| Metafield | Max Length |
|-----------|------------|
| `artist` | 255 chars |
| `title` | 255 chars |
| `album` | 255 chars |
| `format` | 100 chars |
| `media_condition` | 50 chars |
| `sleeve_condition` | 50 chars |
| `condition` | 50 chars |
| `style_genre` | 100 chars |
| `computed_master_label` | 255 chars |
| `label` | 255 chars |
| `computed_label` | 255 chars |
| `catno` | 100 chars |
| `catalogue_number` | 100 chars |
| `collectibility_score` | 50 chars |
| `enhanced_keywords` | 1000 chars |
| `location` | 255 chars |
| `computed_release_year` | 10 chars |

## Owner Types

Most metafields are **product-level** (`owner_type: "product"`), but two are **variant-level**:

- `media_rating` - Variant-level
- `cover_rating` - Variant-level

These allow different condition ratings per variant (e.g., different vinyl conditions for the same album).

## Usage in Theme

### Liquid Templates

```liquid
{{ product.metafields.custom.artist.value }}
{{ product.metafields.custom.title.value }}
{{ product.metafields.custom.format.value }}

{% for genre in product.metafields.custom.computed_style_genre.value %}
  {{ genre }}
{% endfor %}
```

### JavaScript

```javascript
// Access via Storefront API
product.artist?.value
product.title_metafield?.value
product.style_genre?.value
```

### Section Rendering API

```javascript
// Pass to rendering endpoint
{
  main_product_handle: "product-handle",
  variant_handles: ["variant1", "variant2"],
  ...
}
```

## Verification

After creating metafields, verify:

1. **In Shopify Admin:**
   - Go to Settings > Custom data > Products
   - Confirm all 26 metafields are listed
   - Check types are correct

2. **On Product Pages:**
   - Edit a product
   - Scroll to Metafields section
   - Confirm fields appear with correct types

3. **In Theme:**
   - Visit a collection page
   - Check browser console for errors
   - Verify product grouping works
   - Test filtering by metafields

## Troubleshooting

### Metafields Not Creating

1. **Check App API Configuration:**
   - Verify API URL, Store ID, and API Key in theme settings
   - Check browser console for API errors
   - Verify app is installed and running

2. **Check localStorage:**
   - Open browser console
   - Run: `localStorage.getItem('discosync_metafields_created')`
   - If `null`, automatic creation hasn't run yet

3. **Manual Creation:**
   - If automatic fails, create manually
   - Use `config/metafields.json` as reference
   - Follow manual creation steps above

### Wrong Types

1. **Delete and Recreate:**
   - Delete incorrect metafield definition
   - Recreate with correct type from list

2. **Check Validation:**
   - Verify type matches Shopify's valid types
   - See `server/middleware/validation.js` for valid types

### Products Not Grouping

1. **Verify Required Metafields:**
   - Ensure `artist`, `title`, `format` exist
   - Check products have values in these fields
   - Verify no typos in namespace/key

2. **Check Storefront API:**
   - Verify Storefront API token is set
   - Check metafields are queryable
   - Verify GraphQL queries include metafields

## Related Files

- `config/metafields.json` - Complete metafield definitions
- `layout/theme.liquid` - Automatic creation script
- `sections/metafield-setup.liquid` - Manual setup section
- `config/METAFIELDS_SETUP.md` - Quick reference guide

