import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private users: UsersService,
    private jwt: JwtService,
  ) {}

  async register(email: string, password: string, name?: string) {
    const existing = await this.users.findByEmail(email);
    if (existing) throw new ConflictException('Email ya registrado');
    const hashed = await bcrypt.hash(password, 10);
    const user = await this.users.create(email, hashed, name);
    return this.buildResponse(user);
  }

  async login(email: string, password: string) {
    const user = await this.users.findByEmail(email);
    if (!user) throw new UnauthorizedException('Credenciales incorrectas');
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new UnauthorizedException('Credenciales incorrectas');
    // Invalidate all previous sessions
    const sessionToken = randomUUID();
    await this.users.setSessionToken(user.id, sessionToken);
    user.sessionToken = sessionToken;
    return this.buildResponse(user);
  }

  async refreshToken(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException();
    return this.buildResponse(user);
  }

  buildResponse(user: User) {
    const token = this.jwt.sign({
      sub: user.id,
      email: user.email,
      plan: user.plan,
      selectedCountry: user.selectedCountry ?? null,
      selectedPlatform: user.selectedPlatform ?? null,
      sessionToken: user.sessionToken ?? null,
    });
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        plan: user.plan,
        selectedCountry: user.selectedCountry ?? null,
        selectedPlatform: user.selectedPlatform ?? null,
        planExpiresAt: user.planExpiresAt ?? null,
      },
    };
  }
}
