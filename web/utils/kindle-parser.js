/**
 * Parse Kindle "My Clippings.txt" file content into highlights
 * @param {string} content - Raw content of My Clippings.txt
 * @returns {Array<{title: string, author: string|null, highlight: string, addedAt: string|null}>}
 */
export function parseMyClippings(content) {
  // Split by the Kindle clipping delimiter
  const clippings = content.split('==========').filter(c => c.trim());
  const highlights = [];

  for (const clipping of clippings) {
    const lines = clipping.trim().split('\n').filter(l => l.trim());
    if (lines.length < 3) continue;

    // First line: Book Title (Author)
    const titleLine = lines[0].trim();
    let title = titleLine;
    let author = null;

    // Extract author from parentheses at the end
    const authorMatch = titleLine.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
    if (authorMatch) {
      title = authorMatch[1].trim();
      author = authorMatch[2].trim();
    }

    // Second line: metadata (type, location, date)
    const metaLine = lines[1].trim();

    // Check if this is a highlight (not a bookmark or note)
    if (!metaLine.toLowerCase().includes('highlight')) {
      continue; // Skip bookmarks and notes
    }

    // Extract date from metadata line
    let addedAt = null;
    const dateMatch = metaLine.match(/Added on (.+)$/i);
    if (dateMatch) {
      try {
        addedAt = new Date(dateMatch[1]).toISOString();
      } catch (e) {
        // Ignore date parsing errors
      }
    }

    // Remaining lines are the highlight text
    const highlightText = lines.slice(2).join('\n').trim();

    if (!highlightText) continue;

    highlights.push({
      title,
      author,
      highlight: highlightText,
      addedAt,
    });
  }

  return highlights;
}

/**
 * Deduplicate highlights by title + highlight text
 * @param {Array} newHighlights - New highlights to import
 * @param {Array} existingHighlights - Existing highlights in database
 * @returns {Array} - Filtered highlights that are not duplicates
 */
export function deduplicateHighlights(newHighlights, existingHighlights) {
  const existingSet = new Set(
    existingHighlights.map(h => `${h.highlight}|||${h.title}`)
  );

  return newHighlights.filter(h => {
    const key = `${h.highlight}|||${h.title}`;
    return !existingSet.has(key);
  });
}
