import { BadRequestException } from '@nestjs/common';

/** Hosts that serve instance credentials / metadata rather than a model API. */
const BLOCKED_HOSTS = new Set(['169.254.169.254', 'metadata.google.internal']);
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);
/** Providers whose whole point is talking to a machine the user runs. */
const LOCAL_PROVIDERS = new Set(['ollama', 'custom']);

/**
 * Guards the outbound request the server makes when testing a user-supplied
 * endpoint. Blocks non-HTTP schemes, cloud metadata hosts, and loopback for
 * providers that are not explicitly local.
 */
export function assertSafeBaseUrl(
  baseUrl: string | undefined,
  provider: string,
): void {
  if (!baseUrl || !baseUrl.trim()) return;

  let url: URL;
  try {
    url = new URL(baseUrl.trim());
  } catch {
    throw new BadRequestException('baseUrl must be a valid absolute URL');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new BadRequestException('baseUrl must use http or https');
  }

  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host)) {
    throw new BadRequestException('baseUrl host is not allowed');
  }

  if (LOOPBACK_HOSTS.has(host) && !LOCAL_PROVIDERS.has(provider)) {
    throw new BadRequestException(
      'baseUrl must not point at loopback for the ' + provider + ' provider',
    );
  }
}
