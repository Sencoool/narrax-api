import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpsertNovelContextDto } from './dto/upsert-novel-context.dto';
import { NovelContextService } from './novel-context.service';

@ApiTags('novel-context')
@Controller('novels/:novelId/context')
export class NovelContextController {
  constructor(private readonly novelContextService: NovelContextService) {}

  @Get()
  @ApiOperation({
    summary: 'ดู context ของนิยาย',
    description: 'ตัวละคร, โลก, โครงเรื่อง, สไตล์ที่ AI จะใช้เป็น memory',
  })
  @ApiParam({ name: 'novelId', description: 'Novel UUID' })
  findOne(@Param('novelId') novelId: string) {
    return this.novelContextService.findOne(novelId);
  }

  @Put()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'อัปเดต context ของนิยาย',
    description:
      'กำหนดตัวละคร, ฉาก, โครงเรื่อง และสไตล์ให้ AI จำและใช้เป็น context เมื่อเขียน',
  })
  @ApiParam({ name: 'novelId', description: 'Novel UUID' })
  upsert(
    @Param('novelId') novelId: string,
    @Body() input: UpsertNovelContextDto,
  ) {
    return this.novelContextService.upsert(novelId, input);
  }
}
