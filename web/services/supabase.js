// Supabase data service for Stash app
// Pure data operations without UI dependencies

import { appState } from '../lib/state.js';

/**
 * Fetch saves with optional view filtering
 * @param {Object} options - Query options
 * @param {string} options.view - Current view filter (all, highlights, articles, archived, weekly)
 * @param {string} options.sortColumn - Column to sort by (default: created_at)
 * @param {string} options.sortDirection - Sort direction: 'asc' or 'desc' (default: desc)
 * @returns {Promise<Array>} Array of save objects
 */
export async function fetchSaves(options = {}) {
  const {
    view = 'all',
    sortColumn = 'created_at',
    sortDirection = 'desc',
  } = options;

  let query = appState.supabase
    .from('saves')
    .select('*')
    .order(sortColumn, { ascending: sortDirection === 'asc' });

  // Apply view filters
  if (view === 'highlights') {
    query = query.not('highlight', 'is', null);
  } else if (view === 'articles') {
    // Articles: no highlight, not a podcast, not a book
    query = query
      .is('highlight', null)
      .or('content_type.is.null,content_type.eq.article');
  } else if (view === 'archived') {
    query = query.eq('is_archived', true);
  } else if (view === 'weekly') {
    // Weekly review - get this week's saves
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    query = query.gte('created_at', weekAgo.toISOString());
  } else {
    query = query.eq('is_archived', false);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error loading saves:', error);
    throw error;
  }

  return data || [];
}

/**
 * Fetch all tags
 * @returns {Promise<Array>} Array of tag objects
 */
export async function fetchTags() {
  const { data, error } = await appState.supabase
    .from('tags')
    .select('*')
    .order('name');

  if (error) {
    console.error('Error loading tags:', error);
    throw error;
  }

  return data || [];
}

/**
 * Fetch all folders
 * @returns {Promise<Array>} Array of folder objects
 */
export async function fetchFolders() {
  const { data, error } = await appState.supabase
    .from('folders')
    .select('*')
    .order('name');

  if (error) {
    console.error('Error loading folders:', error);
    throw error;
  }

  return data || [];
}

/**
 * Toggle archive status of a save
 * @param {string} saveId - Save ID
 * @param {boolean} currentValue - Current is_archived value
 * @returns {Promise<boolean>} New is_archived value
 */
export async function toggleArchive(saveId, currentValue) {
  const newValue = !currentValue;

  const { error } = await appState.supabase
    .from('saves')
    .update({ is_archived: newValue })
    .eq('id', saveId);

  if (error) {
    console.error('Error toggling archive:', error);
    throw error;
  }

  return newValue;
}

/**
 * Toggle favorite status of a save
 * @param {string} saveId - Save ID
 * @param {boolean} currentValue - Current is_favorite value
 * @returns {Promise<boolean>} New is_favorite value
 */
export async function toggleFavorite(saveId, currentValue) {
  const newValue = !currentValue;

  const { error } = await appState.supabase
    .from('saves')
    .update({ is_favorite: newValue })
    .eq('id', saveId);

  if (error) {
    console.error('Error toggling favorite:', error);
    throw error;
  }

  return newValue;
}

/**
 * Delete a save
 * @param {string} saveId - Save ID
 * @returns {Promise<void>}
 */
export async function deleteSave(saveId) {
  const { error } = await appState.supabase
    .from('saves')
    .delete()
    .eq('id', saveId);

  if (error) {
    console.error('Error deleting save:', error);
    throw error;
  }
}

/**
 * Add a tag to a save
 * @param {string} saveId - Save ID
 * @param {string} tagName - Tag name
 * @returns {Promise<Object>} The tag object
 */
export async function addTagToSave(saveId, tagName) {
  // Get or create tag
  let { data: existingTag } = await appState.supabase
    .from('tags')
    .select('*')
    .eq('name', tagName.trim())
    .single();

  if (!existingTag) {
    const { data: newTag, error: createError } = await appState.supabase
      .from('tags')
      .insert({ user_id: appState.user.id, name: tagName.trim() })
      .select()
      .single();

    if (createError) throw createError;
    existingTag = newTag;
  }

  if (existingTag) {
    const { error: linkError } = await appState.supabase
      .from('save_tags')
      .insert({ save_id: saveId, tag_id: existingTag.id });

    if (linkError) throw linkError;
  }

  return existingTag;
}

/**
 * Add multiple tags to a save
 * @param {string} saveId - Save ID
 * @param {string[]} tagNames - Array of tag names
 * @returns {Promise<void>}
 */
export async function addTagsToSave(saveId, tagNames) {
  for (const tagName of tagNames) {
    try {
      await addTagToSave(saveId, tagName);
    } catch (error) {
      console.error(`Error adding tag ${tagName}:`, error);
    }
  }
}

/**
 * Create a new folder
 * @param {string} name - Folder name
 * @param {string} color - Folder color (optional)
 * @returns {Promise<Object>} The created folder
 */
export async function createFolder(name, color = '#6366f1') {
  const { data, error } = await appState.supabase
    .from('folders')
    .insert({ user_id: appState.user.id, name: name.trim(), color })
    .select()
    .single();

  if (error) {
    console.error('Error creating folder:', error);
    throw error;
  }

  return data;
}

/**
 * Search saves using full-text search
 * @param {string} query - Search query
 * @returns {Promise<Array>} Array of matching saves
 */
export async function searchSaves(query) {
  const { data, error } = await appState.supabase.rpc('search_saves', {
    search_query: query,
    user_uuid: appState.user.id,
  });

  if (error) {
    console.error('Error searching saves:', error);
    throw error;
  }

  return data || [];
}

/**
 * Load user digest preferences
 * @returns {Promise<Object|null>} User preferences or null
 */
export async function loadDigestPreferences() {
  const { data, error } = await appState.supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', appState.user.id)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows found, which is ok
    console.error('Error loading digest preferences:', error);
    throw error;
  }

  return data || null;
}

/**
 * Save user digest preferences
 * @param {Object} prefs - Preferences object
 * @param {boolean} prefs.enabled - Whether digest is enabled
 * @param {string} prefs.email - Email address
 * @param {number} prefs.day - Day of week (0-6)
 * @param {number} prefs.hour - Hour of day (0-23)
 * @returns {Promise<void>}
 */
export async function saveDigestPreferences({ enabled, email, day, hour }) {
  const { error } = await appState.supabase
    .from('user_preferences')
    .upsert(
      {
        user_id: appState.user.id,
        digest_enabled: enabled,
        digest_email: email || null,
        digest_day: day,
        digest_hour: hour,
      },
      {
        onConflict: 'user_id',
      }
    );

  if (error) {
    console.error('Error saving digest preferences:', error);
    throw error;
  }
}

/**
 * Load Kindle highlights grouped by book
 * @returns {Promise<{books: Array, total: number}>}
 */
export async function loadKindleHighlights() {
  const { data, error } = await appState.supabase
    .from('saves')
    .select('*')
    .eq('source', 'kindle')
    .order('title', { ascending: true });

  if (error) {
    console.error('Error loading Kindle highlights:', error);
    throw error;
  }

  if (!data || data.length === 0) {
    return { books: [], total: 0 };
  }

  // Group by book title
  const books = {};
  data.forEach((save) => {
    const key = save.title || 'Unknown Book';
    if (!books[key]) {
      books[key] = {
        title: save.title,
        author: save.author,
        highlights: [],
      };
    }
    books[key].highlights.push(save);
  });

  return {
    books: Object.values(books).sort(
      (a, b) => b.highlights.length - a.highlights.length
    ),
    total: data.length,
  };
}

/**
 * Clear all Kindle data
 * @returns {Promise<void>}
 */
export async function clearKindleData() {
  const { error } = await appState.supabase
    .from('saves')
    .delete()
    .eq('source', 'kindle');

  if (error) {
    console.error('Error clearing Kindle data:', error);
    throw error;
  }
}

/**
 * Import Kindle highlights (batch insert)
 * @param {Array} highlights - Array of highlight objects
 * @returns {Promise<number>} Number of imported highlights
 */
export async function importKindleHighlights(highlights) {
  const saves = highlights.map((h) => ({
    user_id: appState.user.id,
    title: h.title,
    author: h.author,
    highlight: h.highlight,
    site_name: 'Kindle',
    source: 'kindle',
    created_at: h.addedAt || new Date().toISOString(),
  }));

  // Batch insert in chunks of 50
  const batchSize = 50;
  for (let i = 0; i < saves.length; i += batchSize) {
    const batch = saves.slice(i, i + batchSize);
    const { error } = await appState.supabase.from('saves').insert(batch);
    if (error) throw error;
  }

  return saves.length;
}

/**
 * Load podcasts
 * @returns {Promise<Array>} Array of podcast saves grouped by show
 */
export async function loadPodcasts() {
  const { data, error } = await appState.supabase
    .from('saves')
    .select('*')
    .eq('content_type', 'podcast')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error loading podcasts:', error);
    throw error;
  }

  return data || [];
}

/**
 * Load books
 * @returns {Promise<Array>} Array of book saves
 */
export async function loadBooks() {
  const { data, error } = await appState.supabase
    .from('saves')
    .select('*')
    .eq('content_type', 'book')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error loading books:', error);
    throw error;
  }

  return data || [];
}

/**
 * Save a book
 * @param {Object} book - Book data
 * @returns {Promise<Object>} The saved book
 */
export async function saveBook(book) {
  const { data, error } = await appState.supabase
    .from('saves')
    .insert({
      user_id: appState.user.id,
      content_type: 'book',
      ...book,
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving book:', error);
    throw error;
  }

  return data;
}

/**
 * Save a podcast
 * @param {Object} podcast - Podcast data
 * @returns {Promise<Object>} The saved podcast
 */
export async function savePodcast(podcast) {
  const { data, error } = await appState.supabase
    .from('saves')
    .insert({
      user_id: appState.user.id,
      content_type: 'podcast',
      ...podcast,
    })
    .select()
    .single();

  if (error) {
    console.error('Error saving podcast:', error);
    throw error;
  }

  return data;
}

/**
 * Get signed URL for audio file
 * @param {string} path - Storage path
 * @returns {Promise<string|null>} Signed URL or null
 */
export async function getSignedAudioUrl(path) {
  const { data, error } = await appState.supabase.storage
    .from('audio')
    .createSignedUrl(path, 3600);

  if (error) {
    console.error('Error getting signed URL:', error);
    return null;
  }

  return data.signedUrl;
}

/**
 * Check for duplicate Kindle highlights
 * @param {Array} highlights - Highlights to check
 * @returns {Promise<Array>} Existing highlights that match
 */
export async function findExistingHighlights() {
  const { data } = await appState.supabase
    .from('saves')
    .select('highlight, title')
    .not('highlight', 'is', null);

  return data || [];
}

/**
 * Update a save
 * @param {string} saveId - Save ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<void>}
 */
export async function updateSave(saveId, updates) {
  const { error } = await appState.supabase
    .from('saves')
    .update(updates)
    .eq('id', saveId);

  if (error) {
    console.error('Error updating save:', error);
    throw error;
  }
}

/**
 * Load all saves for insights/stats
 * @returns {Promise<Array>} All saves
 */
export async function loadAllSaves() {
  const { data, error } = await appState.supabase
    .from('saves')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error loading all saves:', error);
    throw error;
  }

  return data || [];
}
