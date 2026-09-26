/**
 * Pulls a human-readable message out of an unknown thrown value.
 *
 * HTTP client errors carry the API message under `response.data.message`;
 * anything else falls back to `Error.message`, then to the caller's default.
 * Keeps `catch (err: unknown)` blocks free of unsafe `any` access.
 */
export function getErrorMessage(err: unknown, fallback: string): string {
  if (typeof err === 'object' && err !== null) {
    const candidate = err as {
      response?: { data?: { message?: unknown } };
      message?: unknown;
    };
    const fromResponse = candidate.response?.data?.message;
    if (typeof fromResponse === 'string' && fromResponse) return fromResponse;
    if (typeof candidate.message === 'string' && candidate.message) {
      return candidate.message;
    }
  }
  return fallback;
}
