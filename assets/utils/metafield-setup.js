/**
 * Metafield Setup Utility
 * Automatically creates required metafields via app API
 */

import { CONFIG, METAFIELD_KEYS, METAFIELD_TYPES } from '../core/constants.js';
import themeLogger from '../core/logger.js';

// Required metafields configuration (all 26 metafields)
const REQUIRED_METAFIELDS = [
  { namespace: 'custom', key: METAFIELD_KEYS.ARTIST, name: 'Artist', type: METAFIELD_TYPES.SINGLE_LINE_TEXT, description: 'The artist or performer name for music products. Used for grouping and search.', owner_type: 'product' },
  { namespace: 'custom', key: METAFIELD_KEYS.TITLE, name: 'Album Title', type: METAFIELD_TYPES.SINGLE_LINE_TEXT, description: 'The album or release title. Used for grouping products with the same album.', owner_type: 'product' },
  { namespace: 'custom', key: METAFIELD_KEYS.ALBUM, name: 'Album', type: METAFIELD_TYPES.SINGLE_LINE_TEXT, description: 'Album name (alternative to title).', owner_type: 'product' },
  { namespace: 'custom', key: METAFIELD_KEYS.FORMAT, name: 'Format', type: METAFIELD_TYPES.SINGLE_LINE_TEXT, description: 'The physical format of the product (e.g., Vinyl LP, CD, Cassette). Used for grouping and filtering.', owner_type: 'product' },
  { namespace: 'custom', key: METAFIELD_KEYS.COMPUTED_FORMATS, name: 'Computed Formats', type: METAFIELD_TYPES.LIST_SINGLE_LINE_TEXT, description: 'List of all available formats for this release.', owner_type: 'product' },
  { namespace: 'custom', key: METAFIELD_KEYS.MEDIA_CONDITION, name: 'Media Condition', type: METAFIELD_TYPES.SINGLE_LINE_TEXT, description: 'The condition of the media/record itself (e.g., Mint, Near Mint, Very Good). Used for filtering.', owner_type: 'product' },
  { namespace: 'custom', key: METAFIELD_KEYS.SLEEVE_CONDITION, name: 'Sleeve Condition', type: METAFIELD_TYPES.SINGLE_LINE_TEXT, description: 'The condition of the sleeve/cover (e.g., Mint, Near Mint, Very Good). Used for filtering.', owner_type: 'product' },
  { namespace: 'custom', key: METAFIELD_KEYS.CONDITION, name: 'Condition', type: METAFIELD_TYPES.SINGLE_LINE_TEXT, description: 'General condition rating.', owner_type: 'product' },
  { namespace: 'custom', key: 'media_rating', name: 'Media Rating', type: METAFIELD_TYPES.SINGLE_LINE_TEXT, description: 'Media condition rating.', owner_type: 'variant' },
  { namespace: 'custom', key: 'cover_rating', name: 'Cover Rating', type: METAFIELD_TYPES.SINGLE_LINE_TEXT, description: 'Cover/sleeve condition rating.', owner_type: 'variant' },
  { namespace: 'custom', key: METAFIELD_KEYS.STYLE_GENRE, name: 'Style/Genre', type: METAFIELD_TYPES.SINGLE_LINE_TEXT, description: 'The musical style or genre (legacy field).', owner_type: 'product' },
  { namespace: 'custom', key: METAFIELD_KEYS.COMPUTED_STYLE_GENRE, name: 'Computed Style/Genre', type: METAFIELD_TYPES.LIST_SINGLE_LINE_TEXT, description: 'The musical style or genre (computed list). Used for filtering and search relevance.', owner_type: 'product' },
  { namespace: 'custom', key: METAFIELD_KEYS.COMPUTED_MASTER_LABEL, name: 'Master Label', type: METAFIELD_TYPES.SINGLE_LINE_TEXT, description: 'The record label name (primary). Used for More from sections and filtering.', owner_type: 'product' },
  { namespace: 'custom', key: METAFIELD_KEYS.LABEL, name: 'Label', type: METAFIELD_TYPES.SINGLE_LINE_TEXT, description: 'Record label name (alternative field).', owner_type: 'product' },
  { namespace: 'custom', key: METAFIELD_KEYS.COMPUTED_LABEL, name: 'Computed Label', type: METAFIELD_TYPES.SINGLE_LINE_TEXT, description: 'Computed label name.', owner_type: 'product' },
  { namespace: 'custom', key: METAFIELD_KEYS.COMPUTED_OTHER_LABELS, name: 'Computed Other Labels', type: METAFIELD_TYPES.LIST_SINGLE_LINE_TEXT, description: 'List of other record labels associated with this release.', owner_type: 'product' },
  { namespace: 'custom', key: METAFIELD_KEYS.COMPUTED_OTHER_ARTISTS, name: 'Computed Other Artists', type: METAFIELD_TYPES.LIST_SINGLE_LINE_TEXT, description: 'List of other artists featured on this release.', owner_type: 'product' },
  { namespace: 'custom', key: METAFIELD_KEYS.RELEASED, name: 'Release Date', type: METAFIELD_TYPES.DATE, description: 'The release date of the album/release.', owner_type: 'product' },
  { namespace: 'custom', key: METAFIELD_KEYS.COMPUTED_RELEASE_YEAR, name: 'Computed Release Year', type: METAFIELD_TYPES.SINGLE_LINE_TEXT, description: 'The release year (extracted from release date).', owner_type: 'product' },
  { namespace: 'custom', key: METAFIELD_KEYS.CATNO, name: 'Catalog Number', type: METAFIELD_TYPES.SINGLE_LINE_TEXT, description: 'Catalog number for the release.', owner_type: 'product' },
  { namespace: 'custom', key: METAFIELD_KEYS.CATALOGUE_NUMBER, name: 'Catalogue Number', type: METAFIELD_TYPES.SINGLE_LINE_TEXT, description: 'Catalogue number (alternative to catno).', owner_type: 'product' },
  { namespace: 'custom', key: METAFIELD_KEYS.COLLECTIBILITY_SCORE, name: 'Collectibility Score', type: METAFIELD_TYPES.SINGLE_LINE_TEXT, description: 'Collectibility or rarity score for the item.', owner_type: 'product' },
  { namespace: 'custom', key: METAFIELD_KEYS.ENHANCED_KEYWORDS, name: 'Enhanced Keywords', type: METAFIELD_TYPES.SINGLE_LINE_TEXT, description: 'Enhanced search keywords for improved discoverability.', owner_type: 'product' },
  { namespace: 'custom', key: METAFIELD_KEYS.LOCATION, name: 'Location', type: METAFIELD_TYPES.SINGLE_LINE_TEXT, description: 'Physical storage location (for store owner/staff use).', owner_type: 'product' },
  { namespace: 'custom', key: METAFIELD_KEYS.HAS_360_VIEW, name: 'Has 360 View', type: METAFIELD_TYPES.BOOLEAN, description: 'Whether the product has a 360-degree view available.', owner_type: 'product' },
  { namespace: 'custom', key: METAFIELD_KEYS.TRACKLIST, name: 'Tracklist', type: METAFIELD_TYPES.MULTI_LINE_TEXT, description: 'Track listing for the album/release.', owner_type: 'product' },
];

/**
 * Initialize metafield setup
 */
function initMetafieldSetup() {
  // Only run once per session
  if (sessionStorage.getItem('discosync_metafields_check_done')) {
    return;
  }
  sessionStorage.setItem('discosync_metafields_check_done', 'true');

  // Check if metafields have already been created (persisted check)
  const metafieldsCreated = localStorage.getItem('discosync_metafields_created');
  if (metafieldsCreated === 'true') {
    themeLogger.debug('Metafields already created, skipping setup');
    return;
  }

  // Get app API configuration from meta tags
  const appApiUrl = document.querySelector('meta[name="discosync-api-url"]')?.content || '';
  const storeId = document.querySelector('meta[name="discosync-store-id"]')?.content || '';
  const apiKey = document.querySelector('meta[name="discosync-api-key"]')?.content || '';

  // If app API is not configured, skip silently (will be created manually or via app)
  if (!appApiUrl || !storeId || !apiKey) {
    themeLogger.debug('App API not configured, skipping automatic metafield creation');
    return;
  }

  // Attempt to create metafields via app API (non-blocking)
  createMetafields(appApiUrl, storeId, apiKey);
}

/**
 * Create metafields via app API
 */
async function createMetafields(appApiUrl, storeId, apiKey) {
  try {
    themeLogger.log('Attempting to create metafields via app API...');

    const response = await fetch(`${appApiUrl}${CONFIG.APP_API_ENDPOINT}/${storeId}/bulk`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        metafields: REQUIRED_METAFIELDS,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.success) {
      themeLogger.log('✅ Metafields created successfully');
      localStorage.setItem('discosync_metafields_created', 'true');
      if (data.data?.jobId) {
        localStorage.setItem('discosync_metafields_job_id', data.data.jobId);
      }
    } else {
      themeLogger.warn('Metafield creation returned:', data);
    }
  } catch (error) {
    // Fail silently - metafields will need to be created manually or via app
    themeLogger.debug('Metafield auto-creation unavailable:', error.message);
    if (themeLogger.isDebug) {
      themeLogger.warn('Automatic metafield creation failed. Create manually or configure app API.', error);
    }
  }
}

// Initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMetafieldSetup);
} else {
  initMetafieldSetup();
}

export { initMetafieldSetup, createMetafields, REQUIRED_METAFIELDS };

