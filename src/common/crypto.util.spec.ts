import { decryptApiKey, encryptApiKey, maskApiKey } from './crypto.util.js';

const ORIGINAL_KEY = process.env.MODEL_ENCRYPTION_KEY;
const ORIGINAL_JWT = process.env.JWT_SECRET;

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.MODEL_ENCRYPTION_KEY;
  else process.env.MODEL_ENCRYPTION_KEY = ORIGINAL_KEY;
  if (ORIGINAL_JWT === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = ORIGINAL_JWT;
});

describe('crypto.util', () => {
  it('round-trips an api key', () => {
    process.env.MODEL_ENCRYPTION_KEY = 'unit-test-key';
    const encrypted = encryptApiKey('sk-abc1234567890');
    expect(encrypted).not.toContain('abc1234567890');
    expect(decryptApiKey(encrypted)).toBe('sk-abc1234567890');
  });

  it('refuses to encrypt without a configured key', () => {
    delete process.env.MODEL_ENCRYPTION_KEY;
    delete process.env.JWT_SECRET;
    expect(() => encryptApiKey('sk-abc')).toThrow(/MODEL_ENCRYPTION_KEY/);
  });

  it('masks the middle of a key', () => {
    expect(maskApiKey('sk-1234567890abcd')).toBe('sk-...abcd');
  });
});
