import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy, VerifyCallback } from 'passport-google-oauth20';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID') || 'no-client-id',
      clientSecret:
        configService.get<string>('GOOGLE_CLIENT_SECRET') || 'no-secret',
      callbackURL: configService.get<string>('GOOGLE_CALLBACK_URL'),
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<void> {
    const { id, name, emails } = profile;
    const user = await this.authService.validateGoogleUser({
      googleId: id,
      email: emails?.[0]?.value || '',
      name: name?.givenName + (name?.familyName ? ` ${name.familyName}` : ''),
    });
    done(null, user);
  }
}
