import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateEpisodeDto } from './dto/create-episode.dto';
import { UpdateEpisodeDto } from './dto/update-episode.dto';
import { AppendConversationMessageDto } from './dto/append-conversation-message.dto';
import { FileParserService } from './file-parser.service';
import { CreateEpisodeUseCase } from '../application/use-cases/episodes/create-episode.use-case';
import { UploadEpisodeContentUseCase } from '../application/use-cases/episodes/upload-episode-content.use-case';
import { FindEpisodesUseCase } from '../application/use-cases/episodes/find-episodes.use-case';
import { FindOneEpisodeUseCase } from '../application/use-cases/episodes/find-one-episode.use-case';
import { UpdateEpisodeUseCase } from '../application/use-cases/episodes/update-episode.use-case';
import { DeleteEpisodeUseCase } from '../application/use-cases/episodes/delete-episode.use-case';
import { GenerateEpisodeSummaryUseCase } from '../application/use-cases/episodes/generate-episode-summary.use-case';
import { ChunkAndEmbedUseCase } from '../application/use-cases/rag/chunk-and-embed.use-case';
import { GetConversationUseCase } from '../application/use-cases/episodes/get-conversation.use-case';
import { AppendConversationMessageUseCase } from '../application/use-cases/episodes/append-conversation-message.use-case';
import { ClearConversationUseCase } from '../application/use-cases/episodes/clear-conversation.use-case';
import { FindEpisodeRevisionsUseCase } from '../application/use-cases/episodes/find-episode-revisions.use-case';
import { RestoreEpisodeRevisionUseCase } from '../application/use-cases/episodes/restore-episode-revision.use-case';
import { Logger } from '@nestjs/common';

@ApiTags('episodes')
@Controller()
export class EpisodesController {
  private readonly logger = new Logger(EpisodesController.name);

  constructor(
    private readonly createEpisodeUseCase: CreateEpisodeUseCase,
    private readonly uploadEpisodeContentUseCase: UploadEpisodeContentUseCase,
    private readonly findEpisodesUseCase: FindEpisodesUseCase,
    private readonly findOneEpisodeUseCase: FindOneEpisodeUseCase,
    private readonly updateEpisodeUseCase: UpdateEpisodeUseCase,
    private readonly deleteEpisodeUseCase: DeleteEpisodeUseCase,
    private readonly generateEpisodeSummaryUseCase: GenerateEpisodeSummaryUseCase,
    private readonly chunkAndEmbedUseCase: ChunkAndEmbedUseCase,
    private readonly fileParserService: FileParserService,
    private readonly getConversationUseCase: GetConversationUseCase,
    private readonly appendConversationMessageUseCase: AppendConversationMessageUseCase,
    private readonly clearConversationUseCase: ClearConversationUseCase,
    private readonly findEpisodeRevisionsUseCase: FindEpisodeRevisionsUseCase,
    private readonly restoreEpisodeRevisionUseCase: RestoreEpisodeRevisionUseCase,
  ) {}

  @Post('novels/:novelId/episodes')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create episode' })
  @ApiParam({ name: 'novelId', description: 'Novel UUID' })
  async create(
    @CurrentUser() user: { id: string },
    @Param('novelId') novelId: string,
    @Body() input: CreateEpisodeDto,
  ) {
    const episode = await this.createEpisodeUseCase.execute(novelId, user.id, {
      title: input.title,
      order: input.order,
      isPublished: input.isPublished,
      content: input.content,
      cast: input.cast,
    });

    // Fire-and-forget: embed + summary
    this.triggerEmbedding(episode.id, episode.title);
    if (episode.hasContent()) {
      this.triggerSummaryGeneration(episode.id, episode.title, user.id);
    }

    return episode;
  }

  @Post('novels/:novelId/episodes/upload-content')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Text file to upload (.txt, max 5MB)',
        },
        title: {
          type: 'string',
          description: '("N")',
        },
        order: {
          type: 'number',
          description: 'Episode order',
        },
      },
      required: ['file'],
    },
  })
  @ApiOperation({ summary: 'Upload episode content from .txt file' })
  @ApiResponse({
    status: 201,
    description: 'Episode created. AI summary + embedding runs in background',
  })
  async uploadContent(
    @CurrentUser() user: { id: string },
    @Param('novelId') novelId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() { title, order }: { title: string; order: number },
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // File parsing happens in infrastructure (FileParserService)
    const text = this.fileParserService.extractText(file);

    const episode = await this.uploadEpisodeContentUseCase.execute({
      novelId,
      userId: user.id,
      text,
      title: title ?? null,
      order,
    });

    // Fire-and-forget: embed + summary
    this.triggerEmbedding(episode.id, episode.title);
    this.triggerSummaryGeneration(episode.id, episode.title, user.id);

    return episode;
  }

  @Get('novels/:novelId/episodes')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'List episodes' })
  @ApiParam({ name: 'novelId', description: 'Novel UUID' })
  findAll(
    @CurrentUser() user: { id: string } | undefined,
    @Param('novelId') novelId: string,
  ) {
    return this.findEpisodesUseCase.execute(novelId, user);
  }

  @Get('episodes/:id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get episode by ID' })
  findOne(
    @CurrentUser() user: { id: string } | undefined,
    @Param('id') id: string,
  ) {
    return this.findOneEpisodeUseCase.execute(id, user);
  }

  @Patch('episodes/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update episode' })
  async update(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() input: UpdateEpisodeDto,
  ) {
    const episode = await this.updateEpisodeUseCase.execute(id, user.id, {
      title: input.title,
      content: input.content,
      order: input.order,
      isPublished: input.isPublished,
      cast: input.cast,
    });

    // Re-embed and re-summarise if content changed
    if (input.content) {
      this.triggerEmbedding(episode.id, episode.title);
      this.triggerSummaryGeneration(episode.id, episode.title, user.id);
    }

    return episode;
  }

  @Post('episodes/:id/generate-summary')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate AI episode summary' })
  @ApiParam({ name: 'id', description: 'Episode UUID' })
  @ApiResponse({ status: 200, description: 'Episode with generated summary' })
  generateSummary(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    return this.generateEpisodeSummaryUseCase.execute(id, user.id);
  }

  @Delete('episodes/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete episode' })
  async remove(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    await this.deleteEpisodeUseCase.execute(id, user.id);
  }

  // -- Private fire-and-forget helpers --

  private triggerEmbedding(episodeId: string, episodeTitle: string): void {
    this.chunkAndEmbedUseCase
      .execute(episodeId)
      .then(() => {
        this.logger.log('Embedded episode: ' + episodeTitle);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(
          'Failed to embed episode ' + episodeTitle + ': ' + msg,
        );
      });
  }

  //  Conversation History

  @Get('episodes/:id/conversation')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get conversation history for an episode' })
  @ApiParam({ name: 'id', description: 'Episode UUID' })
  async getConversation(
    @CurrentUser() user: { id: string },
    @Param('id') episodeId: string,
  ) {
    return this.getConversationUseCase.execute(episodeId, user.id);
  }

  @Post('episodes/:id/conversation')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Append a message to episode conversation history' })
  @ApiParam({ name: 'id', description: 'Episode UUID' })
  async appendConversation(
    @CurrentUser() user: { id: string },
    @Param('id') episodeId: string,
    @Body() body: AppendConversationMessageDto,
  ) {
    return this.appendConversationMessageUseCase.execute(
      {
        episodeId,
        role: body.role,
        content: body.content,
        status: body.status,
      },
      user.id,
    );
  }

  @Delete('episodes/:id/conversation')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Clear conversation history for an episode' })
  @ApiParam({ name: 'id', description: 'Episode UUID' })
  async clearConversation(
    @CurrentUser() user: { id: string },
    @Param('id') episodeId: string,
  ) {
    await this.clearConversationUseCase.execute(episodeId, user.id);
  }

  //  Episode Revisions

  @Get('episodes/:id/revisions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ดูประวัติเวอร์ชันของตอน (ใหม่สุดก่อน)' })
  @ApiParam({ name: 'id', description: 'Episode UUID' })
  async getEpisodeRevisions(
    @CurrentUser() user: { id: string },
    @Param('id') episodeId: string,
  ) {
    return this.findEpisodeRevisionsUseCase.execute(episodeId, user.id);
  }

  @Post('episodes/:id/revisions/:revisionId/restore')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'กู้คืนตอนจากเวอร์ชันที่เก็บไว้' })
  @ApiParam({ name: 'id', description: 'Episode UUID' })
  @ApiParam({ name: 'revisionId', description: 'EpisodeRevision UUID' })
  async restoreEpisodeRevision(
    @CurrentUser() user: { id: string },
    @Param('id') episodeId: string,
    @Param('revisionId') revisionId: string,
  ) {
    return this.restoreEpisodeRevisionUseCase.execute({
      episodeId,
      revisionId,
      userId: user.id,
    });
  }

  private triggerSummaryGeneration(
    episodeId: string,
    episodeTitle: string,
    userId: string,
  ): void {
    this.generateEpisodeSummaryUseCase
      .execute(episodeId, userId)
      .then(() => {
        this.logger.log('Generated summary for episode: ' + episodeTitle);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(
          'Failed to generate summary for episode ' + episodeTitle + ': ' + msg,
        );
      });
  }
}
