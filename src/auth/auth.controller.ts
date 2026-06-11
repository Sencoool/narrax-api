import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'สมัครสมาชิก (Email/Password)' })
  async register(@Body() createUserDto: CreateUserDto) {
    if (!createUserDto.password) {
      throw new UnauthorizedException(
        'Password is required for email registration',
      );
    }
    const user = await this.usersService.create(createUserDto);
    return this.authService.generateJwt({ id: user.id, email: user.email });
  }

  @Post('login')
  @ApiOperation({ summary: 'เข้าสู่ระบบ (Email/Password)' })
  async login(@Body() loginDto: CreateUserDto) {
    if (!loginDto.password) {
      throw new UnauthorizedException('Password is required');
    }
    const result = await this.usersService.login(
      loginDto.email,
      loginDto.password,
    );
    if ('error' in result) {
      throw new UnauthorizedException(result.error);
    }
    return this.authService.generateJwt({
      id: result.user.id,
      email: result.user.email,
    });
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

    // Redirect กลับไปที่หน้าบ้าน (Vite) พร้อมแนบ token
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
