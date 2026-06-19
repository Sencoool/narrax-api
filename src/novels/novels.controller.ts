import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateNovelDto } from './dto/create-novel.dto';
import { FindNovelsDto } from './dto/find-novels.dto';
import { UpdateNovelDto } from './dto/update-novel.dto';
import { UpsertNovelContextDto } from './dto/upsert-novel-context.dto';
import { NovelsService } from './novels.service';

@ApiTags('novels')
@Controller('novels')
export class NovelsController {
  constructor(private readonly novelsService: NovelsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'สร้างนิยายใหม่' })
  create(@CurrentUser() user: { id: string }, @Body() input: CreateNovelDto) {
    return this.novelsService.create(user.id, input);
  }

  @Get()
  @ApiOperation({ summary: 'รายการนิยายทั้งหมด (paginated)' })
  findAll(@Query() query: FindNovelsDto) {
    return this.novelsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'ดูรายละเอียดนิยาย' })
  findOne(@Param('id') id: string) {
    return this.novelsService.findOne(id);
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
    return this.novelsService.update(id, user.id, input);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'ลบนิยาย' })
  remove(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.novelsService.remove(id, user.id);
  }

  // --- Context ---

  @Get(':novelId/context')
  @ApiOperation({
    summary: 'ดู context ของนิยาย',
    description: 'ตัวละคร, โลก, โครงเรื่อง, สไตล์ที่ AI จะใช้เป็น memory',
  })
  @ApiParam({ name: 'novelId', description: 'Novel UUID' })
  findContext(@Param('novelId') novelId: string) {
    return this.novelsService.findContext(novelId);
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
    @Body() input: UpsertNovelContextDto,
  ) {
    return this.novelsService.upsertContext(novelId, input);
  }
}
