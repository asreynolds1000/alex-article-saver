// Kindle service for Stash app
// Handles Kindle highlight import and management

import { appState, setPendingKindleImport } from '../lib/state.js';
import { parseMyClippings, deduplicateHighlights } from '../utils/kindle-parser.js';
import {
  loadKindleHighlights as fetchKindleHighlights,
  clearKindleData as clearAllKindleData,
  importKindleHighlights,
  findExistingHighlights,
} from './supabase.js';

/**
 * Load Kindle highlights grouped by book
 * @returns {Promise<{books: Array, total: number}>}
 */
export async function loadKindleHighlights() {
  return fetchKindleHighlights();
}

/**
 * Clear all Kindle data
 * @returns {Promise<void>}
 */
export async function clearKindleData() {
  return clearAllKindleData();
}

/**
 * Process a Kindle clippings file
 * Parses the file and identifies duplicates
 * @param {File} file - The My Clippings.txt file
 * @returns {Promise<{newHighlights: Array, duplicateCount: number, total: number}>}
 */
export async function processKindleFile(file) {
  if (!file.name.endsWith('.txt')) {
    throw new Error(
      'Please upload a .txt file (My Clippings.txt from your Kindle)'
    );
  }

  const content = await file.text();
  const highlights = parseMyClippings(content);

  if (highlights.length === 0) {
    throw new Error(
      "No highlights found in this file. Make sure it's a valid My Clippings.txt file."
    );
  }

  // Check for duplicates against existing saves
  const existingSaves = await findExistingHighlights();
  const newHighlights = deduplicateHighlights(highlights, existingSaves);
  const duplicateCount = highlights.length - newHighlights.length;

  // Store pending import in state
  setPendingKindleImport(newHighlights);

  return {
    newHighlights,
    duplicateCount,
    total: highlights.length,
  };
}

/**
 * Group highlights by book title
 * @param {Array} highlights - Array of highlights
 * @returns {Object} Object with book titles as keys
 */
export function groupHighlightsByBook(highlights) {
  const books = {};

  highlights.forEach((h) => {
    const key = h.title || 'Unknown Book';
    if (!books[key]) {
      books[key] = {
        title: h.title,
        author: h.author,
        count: 0,
        highlights: [],
      };
    }
    books[key].count++;
    books[key].highlights.push(h);
  });

  return books;
}

/**
 * Confirm and execute Kindle import
 * @returns {Promise<number>} Number of imported highlights
 */
export async function confirmImport() {
  const pending = appState.pendingKindleImport;

  if (!pending || pending.length === 0) {
    setPendingKindleImport(null);
    return 0;
  }

  const count = await importKindleHighlights(pending);
  setPendingKindleImport(null);

  return count;
}

/**
 * Cancel pending import
 */
export function cancelImport() {
  setPendingKindleImport(null);
}

/**
 * Check if there's a pending import
 * @returns {boolean}
 */
export function hasPendingImport() {
  return (
    appState.pendingKindleImport !== null &&
    appState.pendingKindleImport.length > 0
  );
}

/**
 * Get pending import data
 * @returns {Array|null}
 */
export function getPendingImport() {
  return appState.pendingKindleImport;
}
