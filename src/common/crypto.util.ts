import * as crypto from 'crypto';

/**
 * Derives a 32-byte key from MODEL_ENCRYPTION_KEY or fallback secret.
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.MODEL_ENCRYPTION_KEY || process.env.JWT_SECRET || 'plot-weaver-default-model-key-32b';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Output format: `ivHex:authTagHex:encryptedHex`
 */
export function encryptApiKey(plaintext: string): string {
  if (!plaintext) return '';
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM encrypted string.
 * Expects format: `ivHex:authTagHex:encryptedHex`
 */
export function decryptApiKey(encryptedPayload: string): string {
  if (!encryptedPayload) return '';
  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) {
    // If not in encrypted format (e.g. legacy plain text), return as is
    return encryptedPayload;
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Masks an API key for safe client display (e.g., `sk-...4a1b`).
 */
export function maskApiKey(apiKey: string): string {
  if (!apiKey) return '';
  const trimmed = apiKey.trim();
  if (trimmed.length <= 8) return '****';
  if (trimmed.startsWith('sk-')) {
    return `sk-...${trimmed.slice(-4)}`;
  }
  const prefix = trimmed.slice(0, 3);
  const suffix = trimmed.slice(-4);
  return `${prefix}...${suffix}`;
}
