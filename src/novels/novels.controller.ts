import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CreateNovelDto } from './dto/create-novel.dto';
import { FindNovelsDto } from './dto/find-novels.dto';
import { UpdateNovelDto } from './dto/update-novel.dto';
import { NovelsService } from './novels.service';

// TODO: แทนที่ด้วย authorId จาก JWT token เมื่อเพิ่ม Auth แล้ว
const DEV_AUTHOR_ID = 'dev-author-placeholder';

@ApiTags('novels')
@Controller('novels')
export class NovelsController {
  constructor(private readonly novelsService: NovelsService) {}

  @Post()
  @ApiOperation({ summary: 'สร้างนิยายใหม่' })
  create(@Body() input: CreateNovelDto) {
    // TODO: ใช้ @CurrentUser() decorator แทน DEV_AUTHOR_ID
    return this.novelsService.create(DEV_AUTHOR_ID, input);
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
  @ApiOperation({ summary: 'แก้ไขนิยาย' })
  update(@Param('id') id: string, @Body() input: UpdateNovelDto) {
    return this.novelsService.update(id, DEV_AUTHOR_ID, input);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'ลบนิยาย' })
  remove(@Param('id') id: string) {
    return this.novelsService.remove(id, DEV_AUTHOR_ID);
  }
}
