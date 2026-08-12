import {
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { UpdateUserDto } from './dto/update-user.dto';
import { FindAllUsersUseCase } from '../application/use-cases/users/find-all-users.use-case';
import { FindOneUserUseCase } from '../application/use-cases/users/find-one-user.use-case';
import { UpdateUserUseCase } from '../application/use-cases/users/update-user.use-case';
import { DeleteUserUseCase } from '../application/use-cases/users/delete-user.use-case';

@ApiTags('users')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly findAllUsersUseCase: FindAllUsersUseCase,
    private readonly findOneUserUseCase: FindOneUserUseCase,
    private readonly updateUserUseCase: UpdateUserUseCase,
    private readonly deleteUserUseCase: DeleteUserUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'รายการผู้ใช้ทั้งหมด' })
  async findAll() {
    const users = await this.findAllUsersUseCase.execute();
    return users.map((u) => u.toSafeObject());
  }

  @Get(':id')
  @ApiOperation({ summary: 'ดูข้อมูลผู้ใช้' })
  async findOne(@Param('id') id: string) {
    const user = await this.findOneUserUseCase.execute(id);
    return user.toSafeObject();
  }

  @Patch(':id')
  @ApiOperation({ summary: 'แก้ไขข้อมูลผู้ใช้' })
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    const user = await this.updateUserUseCase.execute(id, {
      email: dto.email,
      name: dto.name,
    });
    return user.toSafeObject();
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'ลบผู้ใช้' })
  async remove(@Param('id') id: string) {
    await this.deleteUserUseCase.execute(id);
  }
}
