import { describe, it, expect } from 'vitest';
import { renderBulkImportBook, renderBookCard } from '../../web/ui/renders.js';

describe('renderBulkImportBook', () => {
  const baseBook = {
    title: 'The Great Gatsby',
    author: 'F. Scott Fitzgerald',
    yearRead: 2024,
    selected: true,
    selectedMatchId: 'abc123',
  };

  const baseMatches = [
    {
      id: 'abc123',
      volumeInfo: {
        title: 'The Great Gatsby',
        authors: ['F. Scott Fitzgerald'],
        publishedDate: '1925-04-10',
        imageLinks: { thumbnail: 'https://example.com/cover.jpg' },
      },
    },
    {
      id: 'def456',
      volumeInfo: {
        title: 'The Great Gatsby (Annotated)',
        authors: ['F. Scott Fitzgerald'],
        publishedDate: '2020-01-01',
      },
    },
  ];

  it('should render a book item with title and author', () => {
    const html = renderBulkImportBook(baseBook, 0, [], {});
    expect(html).toContain('The Great Gatsby');
    expect(html).toContain('F. Scott Fitzgerald');
  });

  it('should render year read when provided', () => {
    const html = renderBulkImportBook(baseBook, 0, [], {});
    expect(html).toContain('Year read: 2024');
  });

  it('should render checkbox checked when selected', () => {
    const html = renderBulkImportBook(baseBook, 0, [], {});
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('checked');
  });

  it('should render checkbox unchecked when not selected', () => {
    const book = { ...baseBook, selected: false };
    const html = renderBulkImportBook(book, 0, [], {});
    expect(html).toContain('type="checkbox"');
    expect(html).not.toMatch(/checked(?!.*type="radio")/); // checkbox not checked
  });

  it('should render Google Books matches as radio options', () => {
    const html = renderBulkImportBook(baseBook, 0, baseMatches, {});
    expect(html).toContain('type="radio"');
    expect(html).toContain('The Great Gatsby');
    expect(html).toContain('The Great Gatsby (Annotated)');
  });

  it('should mark selected match as checked', () => {
    const html = renderBulkImportBook(baseBook, 0, baseMatches, {});
    expect(html).toContain('data-match-id="abc123"');
    // The selected match should have checked attribute
    expect(html).toMatch(/value="abc123"[^>]*checked/);
  });

  it('should render cover image when available', () => {
    const html = renderBulkImportBook(baseBook, 0, baseMatches, {});
    expect(html).toContain('src="https://example.com/cover.jpg"');
  });

  it('should render placeholder when no cover image', () => {
    const matchWithoutCover = [
      {
        id: 'xyz789',
        volumeInfo: {
          title: 'Test Book',
          authors: ['Test Author'],
        },
      },
    ];
    const html = renderBulkImportBook(baseBook, 0, matchWithoutCover, {});
    expect(html).toContain('bulk-import-match-cover-placeholder');
  });

  it('should render existing warning badge', () => {
    const html = renderBulkImportBook(baseBook, 0, [], { existing: true });
    expect(html).toContain('Already in library');
    expect(html).toContain('bulk-import-warning existing');
  });

  it('should render duplicate years warning badge', () => {
    const html = renderBulkImportBook(baseBook, 0, [], { duplicateYears: [2023, 2025] });
    expect(html).toContain('Also listed for: 2023, 2025');
    expect(html).toContain('bulk-import-warning duplicate');
  });

  it('should render no-match option when matches exist', () => {
    const html = renderBulkImportBook(baseBook, 0, baseMatches, {});
    expect(html).toContain('data-match-id="no-match"');
    expect(html).toContain('Skip - add without metadata');
  });

  it('should render no matches found message when no matches', () => {
    const html = renderBulkImportBook(baseBook, 0, [], {});
    expect(html).toContain('No matches found');
  });

  it('should limit matches to 3', () => {
    const manyMatches = [
      { id: '1', volumeInfo: { title: 'Book 1' } },
      { id: '2', volumeInfo: { title: 'Book 2' } },
      { id: '3', volumeInfo: { title: 'Book 3' } },
      { id: '4', volumeInfo: { title: 'Book 4' } },
      { id: '5', volumeInfo: { title: 'Book 5' } },
    ];
    const html = renderBulkImportBook(baseBook, 0, manyMatches, {});
    expect(html).toContain('Book 1');
    expect(html).toContain('Book 2');
    expect(html).toContain('Book 3');
    expect(html).not.toContain('Book 4');
    expect(html).not.toContain('Book 5');
  });

  it('should set data-index attribute correctly', () => {
    const html = renderBulkImportBook(baseBook, 5, [], {});
    expect(html).toContain('data-index="5"');
  });

  it('should add selected class when book is selected', () => {
    const html = renderBulkImportBook(baseBook, 0, [], {});
    expect(html).toContain('class="bulk-import-book-item selected');
  });

  it('should add has-warning class when warnings exist', () => {
    const html = renderBulkImportBook(baseBook, 0, [], { existing: true });
    expect(html).toContain('has-warning');
  });

  it('should escape HTML in title and author', () => {
    const dangerousBook = {
      ...baseBook,
      title: '<script>alert("xss")</script>',
      author: '<img src=x onerror="alert(1)">',
    };
    const html = renderBulkImportBook(dangerousBook, 0, [], {});
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;img');
  });
});

describe('renderBookCard', () => {
  it('should render book title', () => {
    const book = {
      id: '1',
      title: 'Test Book',
      author: 'Test Author',
      content: JSON.stringify({ metadata: { yearRead: 2024 } }),
    };
    const html = renderBookCard(book);
    expect(html).toContain('Test Book');
  });

  it('should render book author', () => {
    const book = {
      id: '1',
      title: 'Test Book',
      author: 'Test Author',
      content: '{}',
    };
    const html = renderBookCard(book);
    expect(html).toContain('Test Author');
  });

  it('should render year read from metadata', () => {
    const book = {
      id: '1',
      title: 'Test Book',
      content: JSON.stringify({ metadata: { yearRead: 2024 } }),
    };
    const html = renderBookCard(book);
    expect(html).toContain('2024');
  });

  it('should render cover image when available', () => {
    const book = {
      id: '1',
      title: 'Test Book',
      image_url: 'https://example.com/cover.jpg',
      content: '{}',
    };
    const html = renderBookCard(book);
    expect(html).toContain('src="https://example.com/cover.jpg"');
  });

  it('should render placeholder when no cover', () => {
    const book = {
      id: '1',
      title: 'Test Book',
      content: '{}',
    };
    const html = renderBookCard(book);
    expect(html).toContain('book-card-cover-placeholder');
  });

  it('should use site_name as author fallback', () => {
    const book = {
      id: '1',
      title: 'Test Book',
      site_name: 'Fallback Author',
      content: '{}',
    };
    const html = renderBookCard(book);
    expect(html).toContain('Fallback Author');
  });
});
