import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy, isTokenRevoked } from './jwt.strategy';
import { UserEntity } from '../../domain/entities/user.entity';

const configService = {
  get: (key: string) => (key === 'JWT_SECRET' ? 'test-secret' : undefined),
};

function makeUser(tokensValidFrom: Date | null) {
  return new UserEntity({
    id: 'user-1',
    email: 'writer@example.com',
    name: 'Writer',
    passwordHash: null,
    googleId: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    tokensValidFrom,
  });
}

function makeStrategy(findOne: jest.Mock) {
  return new JwtStrategy(configService as never, { execute: findOne } as never);
}

describe('isTokenRevoked', () => {
  const revokedAt = new Date('2026-09-26T12:00:00Z');
  const toSeconds = (d: Date) => Math.floor(d.getTime() / 1000);

  it('accepts a token issued after the revocation', () => {
    expect(isTokenRevoked(toSeconds(revokedAt) + 1, revokedAt)).toBe(false);
  });

  it('rejects a token issued before the revocation', () => {
    expect(isTokenRevoked(toSeconds(revokedAt) - 1, revokedAt)).toBe(true);
  });

  it('accepts any token when the user has never revoked', () => {
    expect(isTokenRevoked(toSeconds(revokedAt) - 3600, null)).toBe(false);
  });

  it('rejects a token with no iat once the user has revoked', () => {
    expect(isTokenRevoked(undefined, revokedAt)).toBe(true);
  });
});

describe('JwtStrategy', () => {
  beforeEach(() => jest.clearAllMocks());

  it('accepts a live token and exposes only the safe user fields', async () => {
    const findOne = jest.fn().mockResolvedValue(makeUser(null));
    const strategy = makeStrategy(findOne);

    await expect(
      strategy.validate({ sub: 'user-1', email: 'writer@example.com' }),
    ).resolves.toEqual({
      id: 'user-1',
      email: 'writer@example.com',
      name: 'Writer',
    });
  });

  it('rejects a token issued before the user revoked, even though it is validly signed', async () => {
    const revokedAt = new Date('2026-09-26T12:00:00Z');
    const findOne = jest.fn().mockResolvedValue(makeUser(revokedAt));
    const strategy = makeStrategy(findOne);

    await expect(
      strategy.validate({
        sub: 'user-1',
        email: 'writer@example.com',
        iat: Math.floor(revokedAt.getTime() / 1000) - 60,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects when the user no longer exists', async () => {
    const findOne = jest.fn().mockRejectedValue(new Error('not found'));
    const strategy = makeStrategy(findOne);

    await expect(
      strategy.validate({ sub: 'ghost', email: 'ghost@example.com' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
