/**
 * Who may read what.
 *
 * One rule, used by every read path so it cannot drift between routes:
 *   - published content is readable by anyone, signed in or not;
 *   - unpublished content is readable only by its author.
 *
 * Callers answer **404, not 403**, for unpublished content a stranger asked for.
 * A 403 would confirm that a draft with that id exists.
 */
export interface Viewer {
  id?: string;
}

export function isPublished(status: string): boolean {
  return status === 'published';
}

export function isAuthor(authorId: string, viewer?: Viewer): boolean {
  return !!viewer?.id && viewer.id === authorId;
}

/** True when the viewer may read a novel (or an episode inside it). */
export function canRead(
  status: string,
  authorId: string,
  viewer?: Viewer,
): boolean {
  return isPublished(status) || isAuthor(authorId, viewer);
}
