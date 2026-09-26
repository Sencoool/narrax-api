import { RevokeAllTokensUseCase } from './revoke-all-tokens.use-case';

describe('RevokeAllTokensUseCase', () => {
  const userRepo = { revokeTokens: jest.fn() };
  const useCase = new RevokeAllTokensUseCase(userRepo as never);

  beforeEach(() => jest.clearAllMocks());

  it('stamps the revocation for the given user', async () => {
    userRepo.revokeTokens.mockResolvedValue(undefined);

    await useCase.execute('user-1');

    expect(userRepo.revokeTokens).toHaveBeenCalledWith('user-1');
  });
});
