import { canRead, isAuthor, isPublished } from './content-visibility';

describe('content visibility', () => {
  const author = 'author-1';
  const stranger = { id: 'stranger-1' };

  it('lets anyone read published work', () => {
    expect(canRead('published', author)).toBe(true);
    expect(canRead('published', author, stranger)).toBe(true);
  });

  it('hides an unpublished draft from anonymous readers', () => {
    expect(canRead('draft', author)).toBe(false);
    expect(canRead('unpublished', author)).toBe(false);
  });

  it('hides a draft from a signed-in stranger', () => {
    expect(canRead('draft', author, stranger)).toBe(false);
    expect(isAuthor(author, stranger)).toBe(false);
  });

  it('shows a draft to its author', () => {
    expect(canRead('draft', author, { id: author })).toBe(true);
    expect(isAuthor(author, { id: author })).toBe(true);
  });

  it('only treats the exact published status as public', () => {
    expect(isPublished('published')).toBe(true);
    expect(isPublished('draft')).toBe(false);
    expect(isPublished('unpublished')).toBe(false);
  });
});
