import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { FindAllUsersUseCase } from '../application/use-cases/users/find-all-users.use-case';
import { FindOneUserUseCase } from '../application/use-cases/users/find-one-user.use-case';
import { UpdateUserUseCase } from '../application/use-cases/users/update-user.use-case';
import { DeleteUserUseCase } from '../application/use-cases/users/delete-user.use-case';
import { UserEntity } from '../domain/entities/user.entity';

const mockUser = new UserEntity({
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  passwordHash: null,
  googleId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  tokensValidFrom: null,
});

const findAllMock = { execute: jest.fn() };
const findOneMock = { execute: jest.fn() };
const updateMock = { execute: jest.fn() };
const deleteMock = { execute: jest.fn() };

describe('UsersController', () => {
  let controller: UsersController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: FindAllUsersUseCase, useValue: findAllMock },
        { provide: FindOneUserUseCase, useValue: findOneMock },
        { provide: UpdateUserUseCase, useValue: updateMock },
        { provide: DeleteUserUseCase, useValue: deleteMock },
        { provide: AdminGuard, useValue: { canActivate: () => true } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<UsersController>(UsersController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('lists users', async () => {
    findAllMock.execute.mockResolvedValue([mockUser]);

    const result = await controller.findAll();

    expect(findAllMock.execute).toHaveBeenCalled();
    expect(result).toEqual([mockUser.toSafeObject()]);
  });

  it('gets a user by id', async () => {
    findOneMock.execute.mockResolvedValue(mockUser);

    const result = await controller.findOne('user-1');

    expect(findOneMock.execute).toHaveBeenCalledWith('user-1');
    expect(result).toEqual(mockUser.toSafeObject());
  });

  it('updates a user', async () => {
    updateMock.execute.mockResolvedValue(mockUser);

    const result = await controller.update('user-1', {
      email: 'new@example.com',
      name: 'New Name',
    });

    expect(updateMock.execute).toHaveBeenCalledWith('user-1', {
      email: 'new@example.com',
      name: 'New Name',
    });
    expect(result).toEqual(mockUser.toSafeObject());
  });

  it('removes a user', async () => {
    deleteMock.execute.mockResolvedValue(undefined);

    await controller.remove('user-1');

    expect(deleteMock.execute).toHaveBeenCalledWith('user-1');
  });
});
