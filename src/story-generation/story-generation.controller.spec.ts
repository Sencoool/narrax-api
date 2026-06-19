import { Test, TestingModule } from '@nestjs/testing';
import { StoryGenerationController } from './story-generation.controller';
import { StoryGenerationService } from './story-generation.service';

const serviceMock = {
  create: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
};

describe('StoryGenerationController', () => {
  let controller: StoryGenerationController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StoryGenerationController],
      providers: [
        {
          provide: StoryGenerationService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<StoryGenerationController>(
      StoryGenerationController,
    );
    jest.clearAllMocks();
  });

  it('creates a story generation request', async () => {
    serviceMock.create.mockResolvedValue({ id: 'req-1' });

    const result = await controller.create({
      prompt: 'A calm sunrise.',
      provider: 'gemini',
    });

    expect(serviceMock.create).toHaveBeenCalledWith({
      prompt: 'A calm sunrise.',
      provider: 'gemini',
    });
    expect(result).toEqual({ id: 'req-1' });
  });

  it('lists story generation requests', async () => {
    serviceMock.findAll.mockResolvedValue([{ id: 'req-2' }]);

    const result = await controller.findAll({ status: 'queued' });

    expect(serviceMock.findAll).toHaveBeenCalledWith('queued');
    expect(result).toEqual([{ id: 'req-2' }]);
  });

  it('gets a story generation request by id', async () => {
    serviceMock.findOne.mockResolvedValue({ id: 'req-3' });

    const result = await controller.findOne('req-3');

    expect(serviceMock.findOne).toHaveBeenCalledWith('req-3');
    expect(result).toEqual({ id: 'req-3' });
  });

  it('updates a story generation request', async () => {
    serviceMock.update.mockResolvedValue({ id: 'req-4' });

    const result = await controller.update('req-4', {
      status: 'failed',
      error: 'Model timeout',
    });

    expect(serviceMock.update).toHaveBeenCalledWith('req-4', {
      status: 'failed',
      error: 'Model timeout',
    });
    expect(result).toEqual({ id: 'req-4' });
  });
});
