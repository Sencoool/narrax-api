import { BadRequestException } from '@nestjs/common';
import { assertSafeBaseUrl } from './validate-base-url.js';

describe('assertSafeBaseUrl', () => {
  it('accepts ordinary http(s) endpoints', () => {
    expect(() =>
      assertSafeBaseUrl('https://api.openai.com/v1', 'openai'),
    ).not.toThrow();
    expect(() =>
      assertSafeBaseUrl('http://localhost:11434', 'ollama'),
    ).not.toThrow();
  });

  it('accepts an empty value', () => {
    expect(() => assertSafeBaseUrl(undefined, 'openai')).not.toThrow();
    expect(() => assertSafeBaseUrl('', 'openai')).not.toThrow();
  });

  it('rejects non-http schemes', () => {
    expect(() => assertSafeBaseUrl('file:///etc/passwd', 'custom')).toThrow(
      BadRequestException,
    );
    expect(() => assertSafeBaseUrl('gopher://x', 'custom')).toThrow(
      BadRequestException,
    );
  });

  it('rejects cloud metadata endpoints', () => {
    expect(() =>
      assertSafeBaseUrl('http://169.254.169.254/latest/meta-data', 'custom'),
    ).toThrow(BadRequestException);
  });

  it('rejects loopback for cloud providers', () => {
    expect(() => assertSafeBaseUrl('http://127.0.0.1:9999', 'openai')).toThrow(
      BadRequestException,
    );
    expect(() => assertSafeBaseUrl('http://localhost:9999', 'openai')).toThrow(
      BadRequestException,
    );
  });

  it('rejects malformed urls', () => {
    expect(() => assertSafeBaseUrl('not a url', 'custom')).toThrow(
      BadRequestException,
    );
  });
});
