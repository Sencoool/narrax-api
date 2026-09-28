import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { UserModelsService } from './user-models.service.js';
import { CreateUserModelDto } from './dto/create-user-model.dto.js';
import { UpdateUserModelDto } from './dto/update-user-model.dto.js';
import { TestUserModelDto } from './dto/test-user-model.dto.js';

@ApiTags('user-models')
@Controller('user-models')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserModelsController {
  constructor(private readonly service: UserModelsService) {}

  @Get('ollama/models')
  @ApiOperation({ summary: 'รายการโมเดลที่ติดตั้งใน Ollama เครื่องนี้' })
  listLocalModels() {
    return this.service.listLocalModels();
  }

  @Get()
  @ApiOperation({ summary: 'List all model configurations for current user' })
  async list(@CurrentUser() user: { id: string }) {
    return this.service.listForUser(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific model configuration' })
  async getOne(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.service.getOne(user.id, id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new model configuration' })
  async create(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateUserModelDto,
  ) {
    return this.service.create(user.id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a model configuration' })
  async update(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateUserModelDto,
  ) {
    return this.service.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a model configuration' })
  async remove(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    await this.service.delete(user.id, id);
  }

  @Post(':id/set-default')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set a model configuration as active default' })
  async setDefault(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
  ) {
    await this.service.setDefault(user.id, id);
    return { success: true };
  }

  @Post('test')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Test connection to a model configuration' })
  async testConnection(
    @CurrentUser() user: { id: string },
    @Body() dto: TestUserModelDto,
  ) {
    return this.service.testConnection(user.id, dto);
  }
}
