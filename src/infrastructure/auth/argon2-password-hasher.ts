import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import type { IPasswordHasher } from '../../application/ports/password-hasher.port.js';

/**
 * Argon2 implementation of the IPasswordHasher port.
 *
 * Uses the `argon2` npm package with its default settings
 * (Argon2id, memory=65536, iterations=3, parallelism=4).
 */
@Injectable()
export class Argon2PasswordHasher implements IPasswordHasher {
  async hash(plainText: string): Promise<string> {
    return argon2.hash(plainText);
  }

  async verify(hash: string, plainText: string): Promise<boolean> {
    return argon2.verify(hash, plainText);
  }
}
