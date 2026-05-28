import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private users: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get<string>('JWT_SECRET') ?? 'fallback',
    });
  }

  async validate(payload: {
    sub: string;
    email: string;
    plan: string;
    selectedCountry: string | null;
    selectedPlatform: string | null;
    sessionToken: string | null;
  }) {
    const user = await this.users.findById(payload.sub);
    if (!user || user.sessionToken !== payload.sessionToken) return null;
    return {
      id: payload.sub,
      email: payload.email,
      plan: payload.plan,
      selectedCountry: payload.selectedCountry ?? null,
      selectedPlatform: payload.selectedPlatform ?? null,
      planExpiresAt: user.planExpiresAt ?? null,
    };
  }
}
