import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { AuthService } from '../auth/auth.service';
import { Plan } from '../users/user.entity';

@Injectable()
export class SubscriptionsService {
  constructor(
    private users: UsersService,
    private auth: AuthService,
    private config: ConfigService,
  ) {}

  verifyAdminSecret(secret: string) {
    const adminSecret = this.config.get<string>('ADMIN_SECRET');
    if (!adminSecret || secret !== adminSecret) throw new ForbiddenException('Invalid admin secret');
  }

  async activatePlan(
    email: string,
    plan: Plan,
    expiresAt?: Date,
    selectedCountry?: string,
    selectedPlatform?: string,
  ) {
    const user = await this.users.findByEmail(email);
    if (!user) throw new NotFoundException(`Usuario no encontrado: ${email}`);
    const updated = await this.users.updatePlan(user.id, plan, expiresAt, selectedCountry, selectedPlatform);
    return this.auth.buildResponse(updated!);
  }

  async getMyPlan(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException();
    return {
      plan: user.plan,
      selectedCountry: user.selectedCountry ?? null,
      selectedPlatform: user.selectedPlatform ?? null,
      planExpiresAt: user.planExpiresAt ?? null,
      planActivatedAt: user.planActivatedAt ?? null,
    };
  }

  async createUser(
    email: string,
    password: string,
    plan: Plan,
    selectedCountry?: string,
    selectedPlatform?: string,
    name?: string,
  ) {
    const existing = await this.users.findByEmail(email);
    if (existing) throw new ConflictException(`Email ya existe: ${email}`);
    const hashed = await bcrypt.hash(password, 10);
    const user = await this.users.create(email, hashed, name);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    const updated = await this.users.updatePlan(user.id, plan, expiresAt, selectedCountry, selectedPlatform);
    return { id: updated!.id, email: updated!.email, name: updated!.name, plan: updated!.plan, planExpiresAt: updated!.planExpiresAt };
  }

  async renewUser(email: string, days = 30) {
    const user = await this.users.findByEmail(email);
    if (!user) throw new NotFoundException(`Usuario no encontrado: ${email}`);
    const base = user.planExpiresAt && user.planExpiresAt > new Date() ? user.planExpiresAt : new Date();
    const newExpiry = new Date(base);
    newExpiry.setDate(newExpiry.getDate() + days);
    const updated = await this.users.updatePlan(user.id, user.plan, newExpiry);
    return { email: updated!.email, plan: updated!.plan, planExpiresAt: updated!.planExpiresAt };
  }

  async setMsgLimit(email: string, limit: number) {
    const user = await this.users.findByEmail(email);
    if (!user) throw new NotFoundException(`Usuario no encontrado: ${email}`);
    await this.users.setMsgLimit(user.id, limit);
    return { email: user.email, msgMonthlyLimit: limit };
  }

  listUsers() {
    return this.users.findAll();
  }

  async selectCountryPlatform(userId: string, selectedCountry: string, selectedPlatform: string) {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException();
    if (user.plan !== Plan.BASIC) {
      throw new ForbiddenException('Solo plan Básico puede seleccionar país/plataforma aquí');
    }
    const updated = await this.users.setCountryPlatform(userId, selectedCountry, selectedPlatform);
    return this.auth.buildResponse(updated!);
  }
}
