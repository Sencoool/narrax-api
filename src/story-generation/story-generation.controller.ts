import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateStoryGenerationDto } from './dto/create-story-generation.dto';
import { FindStoryGenerationDto } from './dto/find-story-generation.dto';
import { UpdateStoryGenerationDto } from './dto/update-story-generation.dto';
import { StoryGenerationService } from './story-generation.service';

@ApiTags('story-generations')
@Controller('story-generations')
export class StoryGenerationController {
  constructor(
    private readonly storyGenerationService: StoryGenerationService,
  ) {}

  @Post()
  create(@Body() input: CreateStoryGenerationDto) {
    return this.storyGenerationService.create(input);
  }

  @Get()
  findAll(@Query() query: FindStoryGenerationDto) {
    return this.storyGenerationService.findAll(query.status);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.storyGenerationService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() input: UpdateStoryGenerationDto) {
    return this.storyGenerationService.update(id, input);
  }
}
