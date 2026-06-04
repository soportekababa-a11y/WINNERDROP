import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, Plan } from './user.entity';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private repo: Repository<User>) {}

  findByEmail(email: string) {
    return this.repo.findOne({ where: { email } });
  }

  findById(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  create(email: string, hashedPassword: string, name?: string) {
    const user = this.repo.create({ email, password: hashedPassword, name });
    return this.repo.save(user);
  }

  async updatePlan(userId: string, plan: Plan, expiresAt?: Date, selectedCountry?: string, selectedPlatform?: string) {
    await this.repo.update(userId, {
      plan,
      planActivatedAt: new Date(),
      ...(expiresAt !== undefined ? { planExpiresAt: expiresAt } : {}),
      ...(selectedCountry !== undefined ? { selectedCountry } : {}),
      ...(selectedPlatform !== undefined ? { selectedPlatform } : {}),
    });
    return this.repo.findOne({ where: { id: userId } });
  }

  async setCountryPlatform(userId: string, selectedCountry: string, selectedPlatform: string) {
    await this.repo.update(userId, { selectedCountry, selectedPlatform });
    return this.repo.findOne({ where: { id: userId } });
  }

  async setSessionToken(userId: string, token: string) {
    await this.repo.update(userId, { sessionToken: token });
  }

  async setMsgLimit(userId: string, limit: number) {
    await this.repo.update(userId, { msgMonthlyLimit: limit });
  }

  async setMetaCredits(userId: string, credits: number) {
    await this.repo.update(userId, { metaCredits: credits } as any);
  }

  findAll() {
    return this.repo.find({
      select: ['id', 'email', 'name', 'plan', 'selectedCountry', 'selectedPlatform', 'planActivatedAt', 'planExpiresAt', 'msgMonthlyLimit', 'metaCredits', 'isActive', 'createdAt'] as any,
      order: { createdAt: 'DESC' },
    });
  }
}
