import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { LoginUseCase } from '../application/use-cases/auth/login.use-case';
import { RegisterUseCase } from '../application/use-cases/auth/register.use-case';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly registerUseCase: RegisterUseCase,
    private readonly loginUseCase: LoginUseCase,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'สมัครสมาชิก (Email/Password)' })
  async register(@Body() dto: CreateUserDto) {
    const user = await this.registerUseCase.execute({
      email: dto.email,
      name: dto.name ?? null,
      password: dto.password ?? '',
    });
    return this.authService.generateJwt({ id: user.id, email: user.email });
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'เข้าสู่ระบบ (Email/Password)' })
  async login(@Body() dto: CreateUserDto) {
    const user = await this.loginUseCase.execute({
      email: dto.email,
      password: dto.password ?? '',
    });
    return this.authService.generateJwt({ id: user.id, email: user.email });
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'เข้าสู่ระบบด้วย Google (Redirects to Google)' })
  async googleAuth() {
    // Guard redirects to Google
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Google OAuth Callback URL' })
  googleAuthRedirect(@Req() req: Request, @Res() res: Response) {
    const user = req.user as { id: string; email: string };
    const { access_token } = this.authService.generateJwt(user);

    const frontendUrl =
      this.configService.get<string>('FRONTEND_URL') || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/auth/callback?token=${access_token}`);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'ดูข้อมูลตัวเอง' })
  getProfile(
    @CurrentUser() user: { id: string; email: string; name: string | null },
  ) {
    return user;
  }
}
