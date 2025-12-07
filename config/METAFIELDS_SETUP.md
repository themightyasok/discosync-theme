# Required Metafields Configuration

This theme requires specific metafields to function properly with the product grouping and enhanced search features.

## Required Metafields

All metafields use the `custom` namespace and apply to **Products**:

### 1. Artist (`custom.artist`)
- **Type**: Single line text
- **Required**: Yes
- **Max Length**: 255 characters
- **Purpose**: Groups products by artist. Essential for product grouping.
- **Example**: "The Beatles"

### 2. Title (`custom.title`)
- **Type**: Single line text
- **Required**: Yes
- **Max Length**: 255 characters
- **Purpose**: Album/release title. Used for grouping products of the same album.
- **Example**: "Abbey Road"

### 3. Format (`custom.format`)
- **Type**: Single line text
- **Required**: Yes
- **Max Length**: 100 characters
- **Purpose**: Physical format. Used for grouping and filtering.
- **Example**: "Vinyl LP", "CD", "Cassette"

### 4. Media Condition (`custom.media_condition`)
- **Type**: Single line text
- **Required**: No
- **Max Length**: 50 characters
- **Purpose**: Condition of the media/record. Used for filtering.
- **Example**: "Mint", "Near Mint", "Very Good"

### 5. Sleeve Condition (`custom.sleeve_condition`)
- **Type**: Single line text
- **Required**: No
- **Max Length**: 50 characters
- **Purpose**: Condition of the sleeve/cover. Used for filtering.
- **Example**: "Mint", "Near Mint", "Very Good"

### 6. Style/Genre (`custom.computed_style_genre`)
- **Type**: Single line text
- **Required**: No
- **Max Length**: 100 characters
- **Purpose**: Musical style or genre. Used for filtering and search.
- **Example**: "Rock", "Jazz", "Electronic"

### 7. Master Label (`custom.computed_master_label`)
- **Type**: Single line text
- **Required**: No
- **Max Length**: 255 characters
- **Purpose**: Record label name. Used for "More from" sections.
- **Example**: "EMI", "Atlantic Records"

## Setup Methods

### Method 1: Via App API (Recommended)

If you have the DiscoSync app installed, use the bulk metafield creation endpoint:

```bash
POST /api/metafields/:storeId/bulk
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY

{
  "metafields": [
    {
      "namespace": "custom",
      "key": "artist",
      "name": "Artist",
      "type": "single_line_text_field",
      "description": "The artist or performer name for music products",
      "owner_type": "product"
    },
    // ... (see config/metafields.json for full list)
  ]
}
```

### Method 2: Manual Creation in Shopify Admin

1. Go to **Settings > Custom data > Products**
2. Click **Add definition** for each metafield
3. Use the namespace `custom` and keys listed above
4. Set the type to **Single line text**
5. Add descriptions as needed

### Method 3: Via Shopify Admin API

If you have Admin API access, you can create these programmatically:

```graphql
mutation CreateMetafieldDefinition($definition: MetafieldDefinitionInput!) {
  metafieldDefinitionCreate(definition: $definition) {
    metafieldDefinition {
      id
      name
      key
      namespace
    }
    userErrors {
      field
      message
    }
  }
}
```

## Verification

After creating the metafields, verify they exist:

1. Go to **Settings > Custom data > Products**
2. Confirm all 7 metafield definitions are listed
3. Test by editing a product and checking that the metafield fields appear

## Theme Features Using These Metafields

- **Product Grouping**: Groups products by artist + album + format
- **Enhanced Search**: Better search relevance using artist and title
- **Filtering**: Media condition, sleeve condition, and genre filters
- **More From**: "More from this artist/label" sections

## Troubleshooting

If product grouping or search features aren't working:

1. Verify all required metafields (artist, title, format) are created
2. Check that products have values in these metafields
3. Verify the Storefront API token is set in `layout/theme.liquid`
4. Check browser console for any JavaScript errors

