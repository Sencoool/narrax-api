import { Test, TestingModule } from '@nestjs/testing';
import { EpisodesController } from './episodes.controller';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateEpisodeUseCase } from '../application/use-cases/episodes/create-episode.use-case';
import { UploadEpisodeContentUseCase } from '../application/use-cases/episodes/upload-episode-content.use-case';
import { FindEpisodesUseCase } from '../application/use-cases/episodes/find-episodes.use-case';
import { FindOneEpisodeUseCase } from '../application/use-cases/episodes/find-one-episode.use-case';
import { UpdateEpisodeUseCase } from '../application/use-cases/episodes/update-episode.use-case';
import { DeleteEpisodeUseCase } from '../application/use-cases/episodes/delete-episode.use-case';
import { GenerateEpisodeSummaryUseCase } from '../application/use-cases/episodes/generate-episode-summary.use-case';
import { ChunkAndEmbedUseCase } from '../application/use-cases/rag/chunk-and-embed.use-case';
import { FileParserService } from './file-parser.service';
import { GetConversationUseCase } from '../application/use-cases/episodes/get-conversation.use-case';
import { AppendConversationMessageUseCase } from '../application/use-cases/episodes/append-conversation-message.use-case';
import { ClearConversationUseCase } from '../application/use-cases/episodes/clear-conversation.use-case';
import { FindEpisodeRevisionsUseCase } from '../application/use-cases/episodes/find-episode-revisions.use-case';
import { RestoreEpisodeRevisionUseCase } from '../application/use-cases/episodes/restore-episode-revision.use-case';

describe('EpisodesController ownership plumbing', () => {
  let controller: EpisodesController;
  const useCase = () => ({
    execute: jest
      .fn()
      .mockResolvedValue({ id: 'ep-1', title: 'T', hasContent: () => false }),
  });

  const mocks = {
    create: useCase(),
    upload: useCase(),
    findAll: useCase(),
    findOne: useCase(),
    update: useCase(),
    remove: useCase(),
    summary: useCase(),
    embed: useCase(),
    conversation: useCase(),
    revisions: useCase(),
    restoreRevision: useCase(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EpisodesController],
      providers: [
        { provide: CreateEpisodeUseCase, useValue: mocks.create },
        { provide: UploadEpisodeContentUseCase, useValue: mocks.upload },
        { provide: FindEpisodesUseCase, useValue: mocks.findAll },
        { provide: FindOneEpisodeUseCase, useValue: mocks.findOne },
        { provide: UpdateEpisodeUseCase, useValue: mocks.update },
        { provide: DeleteEpisodeUseCase, useValue: mocks.remove },
        { provide: GenerateEpisodeSummaryUseCase, useValue: mocks.summary },
        { provide: ChunkAndEmbedUseCase, useValue: mocks.embed },
        { provide: FileParserService, useValue: { extractText: jest.fn() } },
        { provide: GetConversationUseCase, useValue: mocks.conversation },
        { provide: AppendConversationMessageUseCase, useValue: useCase() },
        { provide: ClearConversationUseCase, useValue: useCase() },
        { provide: FindEpisodeRevisionsUseCase, useValue: mocks.revisions },
        {
          provide: RestoreEpisodeRevisionUseCase,
          useValue: mocks.restoreRevision,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get(EpisodesController);
    jest.clearAllMocks();
  });

  it('passes the caller id into episode update', async () => {
    await controller.update({ id: 'user-1' }, 'ep-1', { title: 'New' });
    expect(mocks.update.execute).toHaveBeenCalledWith('ep-1', 'user-1', {
      title: 'New',
    });
  });

  it('passes the caller id into episode delete', async () => {
    await controller.remove({ id: 'user-1' }, 'ep-1');
    expect(mocks.remove.execute).toHaveBeenCalledWith('ep-1', 'user-1');
  });

  it('passes the caller id into conversation lookup', async () => {
    await controller.getConversation({ id: 'user-1' }, 'ep-1');
    expect(mocks.conversation.execute).toHaveBeenCalledWith('ep-1', 'user-1');
  });

  it('passes the caller id into the revision list', async () => {
    await controller.getEpisodeRevisions({ id: 'user-1' }, 'ep-1');
    expect(mocks.revisions.execute).toHaveBeenCalledWith('ep-1', 'user-1');
  });

  it('passes the caller id into a revision restore', async () => {
    await controller.restoreEpisodeRevision({ id: 'user-1' }, 'ep-1', 'rev-1');
    expect(mocks.restoreRevision.execute).toHaveBeenCalledWith({
      episodeId: 'ep-1',
      revisionId: 'rev-1',
      userId: 'user-1',
    });
  });
});
