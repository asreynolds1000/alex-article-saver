import { describe, it, expect } from 'vitest';
import { parseMyClippings, deduplicateHighlights } from '../../web/utils/kindle-parser.js';

describe('parseMyClippings', () => {
  it('should parse a single highlight', () => {
    const content = `The Great Gatsby (F. Scott Fitzgerald)
- Your Highlight on page 42 | Location 500-502 | Added on Monday, January 15, 2024 10:30:00 AM

In my younger and more vulnerable years my father gave me some advice that I've been turning over in my mind ever since.
==========`;

    const highlights = parseMyClippings(content);

    expect(highlights).toHaveLength(1);
    expect(highlights[0].title).toBe('The Great Gatsby');
    expect(highlights[0].author).toBe('F. Scott Fitzgerald');
    expect(highlights[0].highlight).toBe(
      "In my younger and more vulnerable years my father gave me some advice that I've been turning over in my mind ever since."
    );
    expect(highlights[0].addedAt).toBeTruthy();
  });

  it('should parse multiple highlights from different books', () => {
    const content = `Book One (Author One)
- Your Highlight on page 10 | Added on Monday, January 1, 2024 9:00:00 AM

First highlight text.
==========
Book Two (Author Two)
- Your Highlight on page 20 | Added on Tuesday, January 2, 2024 10:00:00 AM

Second highlight text.
==========`;

    const highlights = parseMyClippings(content);

    expect(highlights).toHaveLength(2);
    expect(highlights[0].title).toBe('Book One');
    expect(highlights[0].author).toBe('Author One');
    expect(highlights[1].title).toBe('Book Two');
    expect(highlights[1].author).toBe('Author Two');
  });

  it('should skip bookmarks (not highlights)', () => {
    const content = `Some Book (Some Author)
- Your Bookmark on page 10 | Location 100 | Added on Monday, January 1, 2024 9:00:00 AM


==========
Some Book (Some Author)
- Your Highlight on page 20 | Location 200 | Added on Monday, January 1, 2024 10:00:00 AM

This is a real highlight.
==========`;

    const highlights = parseMyClippings(content);

    expect(highlights).toHaveLength(1);
    expect(highlights[0].highlight).toBe('This is a real highlight.');
  });

  it('should skip notes (not highlights)', () => {
    const content = `Some Book (Some Author)
- Your Note on page 10 | Location 100 | Added on Monday, January 1, 2024 9:00:00 AM

This is just a note.
==========
Some Book (Some Author)
- Your Highlight on page 20 | Location 200 | Added on Monday, January 1, 2024 10:00:00 AM

This is a real highlight.
==========`;

    const highlights = parseMyClippings(content);

    expect(highlights).toHaveLength(1);
    expect(highlights[0].highlight).toBe('This is a real highlight.');
  });

  it('should handle books without author in parentheses', () => {
    const content = `Unknown Book
- Your Highlight on page 10 | Added on Monday, January 1, 2024 9:00:00 AM

Highlight from unknown book.
==========`;

    const highlights = parseMyClippings(content);

    expect(highlights).toHaveLength(1);
    expect(highlights[0].title).toBe('Unknown Book');
    expect(highlights[0].author).toBeNull();
  });

  it('should handle multi-line highlights', () => {
    const content = `Test Book (Test Author)
- Your Highlight on page 10 | Added on Monday, January 1, 2024 9:00:00 AM

Line one of the highlight.
Line two of the highlight.
Line three of the highlight.
==========`;

    const highlights = parseMyClippings(content);

    expect(highlights).toHaveLength(1);
    expect(highlights[0].highlight).toBe(
      'Line one of the highlight.\nLine two of the highlight.\nLine three of the highlight.'
    );
  });

  it('should return empty array for empty content', () => {
    const highlights = parseMyClippings('');
    expect(highlights).toHaveLength(0);
  });

  it('should return empty array for malformed content', () => {
    const content = 'This is not a valid Kindle clippings file';
    const highlights = parseMyClippings(content);
    expect(highlights).toHaveLength(0);
  });
});

describe('deduplicateHighlights', () => {
  it('should remove duplicates based on highlight + title', () => {
    const newHighlights = [
      { title: 'Book A', author: 'Author', highlight: 'Highlight 1', addedAt: null },
      { title: 'Book A', author: 'Author', highlight: 'Highlight 2', addedAt: null },
      { title: 'Book B', author: 'Author', highlight: 'Highlight 3', addedAt: null },
    ];

    const existingHighlights = [
      { title: 'Book A', highlight: 'Highlight 1' },
    ];

    const result = deduplicateHighlights(newHighlights, existingHighlights);

    expect(result).toHaveLength(2);
    expect(result[0].highlight).toBe('Highlight 2');
    expect(result[1].highlight).toBe('Highlight 3');
  });

  it('should return all highlights when no duplicates exist', () => {
    const newHighlights = [
      { title: 'Book A', author: 'Author', highlight: 'Highlight 1', addedAt: null },
      { title: 'Book B', author: 'Author', highlight: 'Highlight 2', addedAt: null },
    ];

    const existingHighlights: Array<{ title: string; highlight: string }> = [];

    const result = deduplicateHighlights(newHighlights, existingHighlights);

    expect(result).toHaveLength(2);
  });

  it('should return empty array when all are duplicates', () => {
    const newHighlights = [
      { title: 'Book A', author: 'Author', highlight: 'Highlight 1', addedAt: null },
    ];

    const existingHighlights = [
      { title: 'Book A', highlight: 'Highlight 1' },
    ];

    const result = deduplicateHighlights(newHighlights, existingHighlights);

    expect(result).toHaveLength(0);
  });
});
