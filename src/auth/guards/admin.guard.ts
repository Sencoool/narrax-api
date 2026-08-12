import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

/**
 * AdminGuard
 *
 * Restricts access to users whose email is listed in the ADMIN_EMAILS
 * environment variable (comma-separated).
 *
 * Example .env:
 *   ADMIN_EMAILS=admin@example.com,ops@example.com
 *
 * Must be used AFTER JwtAuthGuard so that req.user is already populated.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  private readonly adminEmails: Set<string>;

  constructor(private readonly configService: ConfigService) {
    const raw = configService.get<string>('ADMIN_EMAILS') ?? '';
    this.adminEmails = new Set(
      raw
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    );
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as { email: string } | undefined;

    if (!user?.email) {
      throw new ForbiddenException('ไม่มีสิทธิ์เข้าถึงส่วนนี้');
    }

    if (!this.adminEmails.has(user.email.toLowerCase())) {
      throw new ForbiddenException('เฉพาะผู้ดูแลระบบเท่านั้น');
    }

    return true;
  }
}
