import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateNovelDto } from './dto/create-novel.dto';
import { FindNovelsDto } from './dto/find-novels.dto';
import { UpdateNovelDto } from './dto/update-novel.dto';
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
}
