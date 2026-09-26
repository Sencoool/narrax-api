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
  @ApiOperation({ summary: 'รายการนิยายทั้งหมด (paginated)' })
  findAll(@Query() query: FindNovelsDto) {
    return this.findNovelsUseCase.execute({
      status: query.status,
      authorId: query.authorId,
      page: query.page,
      limit: query.limit,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'ดูรายละเอียดนิยาย' })
  findOne(@Param('id') id: string) {
    return this.findOneNovelUseCase.execute(id);
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
  @ApiOperation({
    summary: 'ดู context ของนิยาย',
    description: 'ตัวละคร, โลก, โครงเรื่อง, สไตล์ที่ AI จะใช้เป็น memory',
  })
  @ApiParam({ name: 'novelId', description: 'Novel UUID' })
  findContext(@Param('novelId') novelId: string) {
    return this.findNovelContextUseCase.execute(novelId);
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
    const characters = input.characters
      ? JSON.stringify(input.characters)
      : undefined;

    return this.upsertNovelContextUseCase.execute(novelId, user.id, {
      characters,
      worldBuilding: input.worldBuilding,
      plotOutline: input.plotOutline,
      writingStyle: input.writingStyle,
    });
  }
}
