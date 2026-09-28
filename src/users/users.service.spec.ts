import { Test, TestingModule } from '@nestjs/testing';
import { LoginUseCase } from '../application/use-cases/auth/login.use-case';
import { RegisterUseCase } from '../application/use-cases/auth/register.use-case';
import { USER_REPOSITORY } from '../domain/repositories/user.repository.interface';
import { PASSWORD_HASHER } from '../application/ports/password-hasher.port';
import { UserEntity } from '../domain/entities/user.entity';
import { DomainConflictError } from '../domain/errors/domain-errors';
import { DomainUnauthorizedError } from '../domain/errors/domain-errors';

const HASHED = '$argon2id$test$hash';

const mockUserRepo = {
  findByEmail: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  findAll: jest.fn(),
  findByGoogleId: jest.fn(),
  linkGoogleId: jest.fn(),
};

const mockHasher = {
  hash: jest.fn().mockResolvedValue(HASHED),
  verify: jest.fn(),
};

const makeUser = (
  overrides: Partial<ConstructorParameters<typeof UserEntity>[0]> = {},
) =>
  new UserEntity({
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test',
    passwordHash: HASHED,
    googleId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    tokensValidFrom: null,
    ...overrides,
  });

describe('Auth Use Cases', () => {
  let registerUseCase: RegisterUseCase;
  let loginUseCase: LoginUseCase;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RegisterUseCase,
        LoginUseCase,
        { provide: USER_REPOSITORY, useValue: mockUserRepo },
        { provide: PASSWORD_HASHER, useValue: mockHasher },
      ],
    }).compile();

    registerUseCase = module.get(RegisterUseCase);
    loginUseCase = module.get(LoginUseCase);
    jest.clearAllMocks();
  });

  // ─── RegisterUseCase ──────────────────────────────────────────────────────

  describe('RegisterUseCase', () => {
    it('creates a new user when email is free', async () => {
      const created = makeUser();
      mockUserRepo.findByEmail.mockResolvedValue(null);
      mockUserRepo.create.mockResolvedValue(created);

      const result = await registerUseCase.execute({
        email: 'test@example.com',
        name: 'Test',
        password: 'password123',
      });

      expect(mockHasher.hash).toHaveBeenCalledWith('password123');
      expect(mockUserRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          passwordHash: HASHED,
        }),
      );
      expect(result).toBe(created);
    });

    it('throws DomainConflictError when email already exists', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(makeUser());

      await expect(
        registerUseCase.execute({
          email: 'test@example.com',
          name: null,
          password: 'pw',
        }),
      ).rejects.toBeInstanceOf(DomainConflictError);
    });
  });

  // ─── LoginUseCase ─────────────────────────────────────────────────────────

  describe('LoginUseCase', () => {
    it('returns the user on valid credentials', async () => {
      const user = makeUser();
      mockUserRepo.findByEmail.mockResolvedValue(user);
      mockHasher.verify.mockResolvedValue(true);

      const result = await loginUseCase.execute({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(mockHasher.verify).toHaveBeenCalledWith(HASHED, 'password123');
      expect(result).toBe(user);
    });

    it('throws DomainUnauthorizedError on wrong password', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(makeUser());
      mockHasher.verify.mockResolvedValue(false);

      await expect(
        loginUseCase.execute({ email: 'test@example.com', password: 'wrong' }),
      ).rejects.toBeInstanceOf(DomainUnauthorizedError);
    });

    it('throws DomainUnauthorizedError when user does not exist', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(null);

      await expect(
        loginUseCase.execute({ email: 'nobody@example.com', password: 'pw' }),
      ).rejects.toBeInstanceOf(DomainUnauthorizedError);
    });
  });
});
