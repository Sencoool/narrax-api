import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { CreateNovelDto } from './dto/create-novel.dto';
import { FindNovelsDto } from './dto/find-novels.dto';
import { UpdateNovelDto } from './dto/update-novel.dto';
import { UpsertNovelContextDto } from './dto/upsert-novel-context.dto';
import { CreateNovelUseCase } from '../application/use-cases/novels/create-novel.use-case';
import { FindNovelsUseCase } from '../application/use-cases/novels/find-novels.use-case';
import { FindOneNovelUseCase } from '../application/use-cases/novels/find-one-novel.use-case';
import { UpdateNovelUseCase } from '../application/use-cases/novels/update-novel.use-case';
import { DeleteNovelUseCase } from '../application/use-cases/novels/delete-novel.use-case';
import { FindNovelContextUseCase } from '../application/use-cases/novels/find-novel-context.use-case';
import { UpsertNovelContextUseCase } from '../application/use-cases/novels/upsert-novel-context.use-case';

import { ListCharacterBoardUseCase } from '../application/use-cases/characters/list-character-board.use-case.js';
import { SaveCharacterUseCase } from '../application/use-cases/characters/save-character.use-case.js';
import { DeleteCharacterUseCase } from '../application/use-cases/characters/delete-character.use-case.js';
import { SaveFactionUseCase } from '../application/use-cases/characters/save-faction.use-case.js';
import { DeleteFactionUseCase } from '../application/use-cases/characters/delete-faction.use-case.js';
import { SaveCharacterDto } from './dto/save-character.dto.js';
import { SaveFactionDto } from './dto/save-faction.dto.js';

@ApiTags('novels')
@Controller('novels')
export class NovelsController {
  constructor(
    private readonly createNovelUseCase: CreateNovelUseCase,
    private readonly findNovelsUseCase: FindNovelsUseCase,
    private readonly findOneNovelUseCase: FindOneNovelUseCase,
    private readonly updateNovelUseCase: UpdateNovelUseCase,
    private readonly deleteNovelUseCase: DeleteNovelUseCase,
    private readonly findNovelContextUseCase: FindNovelContextUseCase,
    private readonly upsertNovelContextUseCase: UpsertNovelContextUseCase,
    private readonly listCharacterBoardUseCase: ListCharacterBoardUseCase,
    private readonly saveCharacterUseCase: SaveCharacterUseCase,
    private readonly deleteCharacterUseCase: DeleteCharacterUseCase,
    private readonly saveFactionUseCase: SaveFactionUseCase,
    private readonly deleteFactionUseCase: DeleteFactionUseCase,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'สร้างนิยายใหม่' })
  create(@CurrentUser() user: { id: string }, @Body() input: CreateNovelDto) {
    return this.createNovelUseCase.execute(user.id, {
      title: input.title,
      summary: input.summary ?? null,
      tags: input.tags,
    });
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'รายการนิยายทั้งหมด (paginated)' })
  findAll(
    @CurrentUser() user: { id: string } | undefined,
    @Query() query: FindNovelsDto,
  ) {
    return this.findNovelsUseCase.execute(
      {
        status: query.status,
        authorId: query.authorId,
        page: query.page,
        limit: query.limit,
      },
      user?.id,
    );
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'ดูรายละเอียดนิยาย' })
  findOne(
    @CurrentUser() user: { id: string } | undefined,
    @Param('id') id: string,
  ) {
    return this.findOneNovelUseCase.execute(id, user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'แก้ไขนิยาย' })
  update(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() input: UpdateNovelDto,
  ) {
    return this.updateNovelUseCase.execute(id, user.id, {
      title: input.title,
      summary: input.summary,
      status: input.status,
      tags: input.tags,
    });
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'ลบนิยาย' })
  async remove(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    await this.deleteNovelUseCase.execute(id, user.id);
  }

  // --- Context ---

  @Get(':novelId/context')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'ดู context ของนิยาย',
    description:
      'ตัวละคร, โลก, โครงเรื่อง, สไตล์ที่ AI จะใช้เป็น memory — เฉพาะเจ้าของเรื่อง',
  })
  @ApiParam({ name: 'novelId', description: 'Novel UUID' })
  findContext(
    @Param('novelId') novelId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.findNovelContextUseCase.execute(novelId, user.id);
  }

  @Put(':novelId/context')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'อัปเดต context ของนิยาย',
    description:
      'กำหนดตัวละคร, ฉาก, โครงเรื่อง และสไตล์ให้ AI จำและใช้เป็น context เมื่อเขียน',
  })
  @ApiParam({ name: 'novelId', description: 'Novel UUID' })
  upsertContext(
    @Param('novelId') novelId: string,
    @CurrentUser() user: { id: string },
    @Body() input: UpsertNovelContextDto,
  ) {
    // Three distinct meanings, and the database distinguishes all three:
    //   omitted  -> leave the stored value alone
    //   null     -> clear it
    //   an array -> replace it (an empty array clears the cast)
    const characters =
      input.characters === undefined
        ? undefined
        : input.characters === null
          ? null
          : JSON.stringify(input.characters);

    return this.upsertNovelContextUseCase.execute(novelId, user.id, {
      characters,
      worldBuilding: input.worldBuilding,
      plotOutline: input.plotOutline,
      writingStyle: input.writingStyle,
    });
  }

  // ??? Characters ????????????????????????????????????????????????????????????

  @Get(':novelId/characters')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get character board' })
  characterBoard(
    @CurrentUser() user: { id: string },
    @Param('novelId') novelId: string,
  ) {
    return this.listCharacterBoardUseCase.execute({ novelId, userId: user.id });
  }

  @Post(':novelId/characters')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create or update a character' })
  saveCharacter(
    @CurrentUser() user: { id: string },
    @Param('novelId') novelId: string,
    @Body() body: SaveCharacterDto,
  ) {
    return this.saveCharacterUseCase.execute({
      novelId,
      userId: user.id,
      ...body,
    });
  }

  @Delete(':novelId/characters/:characterId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a character' })
  async deleteCharacter(
    @CurrentUser() user: { id: string },
    @Param('novelId') novelId: string,
    @Param('characterId') characterId: string,
  ) {
    await this.deleteCharacterUseCase.execute({
      novelId,
      userId: user.id,
      characterId,
    });
  }

  // ??? Factions ??????????????????????????????????????????????????????????????

  @Post(':novelId/factions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create or update a faction' })
  saveFaction(
    @CurrentUser() user: { id: string },
    @Param('novelId') novelId: string,
    @Body() body: SaveFactionDto,
  ) {
    return this.saveFactionUseCase.execute({
      novelId,
      userId: user.id,
      ...body,
    });
  }

  @Delete(':novelId/factions/:factionId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a faction' })
  async deleteFaction(
    @CurrentUser() user: { id: string },
    @Param('novelId') novelId: string,
    @Param('factionId') factionId: string,
  ) {
    await this.deleteFactionUseCase.execute({
      novelId,
      userId: user.id,
      factionId,
    });
  }
}
