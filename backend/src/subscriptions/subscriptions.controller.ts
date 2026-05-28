import { Controller, Post, Get, Body, Headers, UseGuards, Request, HttpCode } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Plan } from '../users/user.entity';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private subs: SubscriptionsService) {}

  @Post('admin/activate')
  @HttpCode(200)
  adminActivate(
    @Headers('x-admin-secret') secret: string,
    @Body() dto: {
      email: string;
      plan: Plan;
      expiresAt?: string;
      selectedCountry?: string;
      selectedPlatform?: string;
    },
  ) {
    this.subs.verifyAdminSecret(secret);
    return this.subs.activatePlan(
      dto.email,
      dto.plan,
      dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      dto.selectedCountry,
      dto.selectedPlatform,
    );
  }

  @Post('admin/create-user')
  @HttpCode(201)
  adminCreateUser(
    @Headers('x-admin-secret') secret: string,
    @Body() dto: {
      email: string;
      password: string;
      plan: Plan;
      name?: string;
      selectedCountry?: string;
      selectedPlatform?: string;
    },
  ) {
    this.subs.verifyAdminSecret(secret);
    return this.subs.createUser(dto.email, dto.password, dto.plan, dto.selectedCountry, dto.selectedPlatform, dto.name);
  }

  @Get('admin/users')
  adminListUsers(@Headers('x-admin-secret') secret: string) {
    this.subs.verifyAdminSecret(secret);
    return this.subs.listUsers();
  }

  @Post('admin/set-msg-limit')
  @HttpCode(200)
  adminSetMsgLimit(
    @Headers('x-admin-secret') secret: string,
    @Body() dto: { email: string; limit: number },
  ) {
    this.subs.verifyAdminSecret(secret);
    return this.subs.setMsgLimit(dto.email, dto.limit);
  }

  @Post('admin/renew')
  @HttpCode(200)
  adminRenew(
    @Headers('x-admin-secret') secret: string,
    @Body() dto: { email: string; days?: number },
  ) {
    this.subs.verifyAdminSecret(secret);
    return this.subs.renewUser(dto.email, dto.days ?? 30);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMyPlan(@Request() req: any) {
    return this.subs.getMyPlan(req.user.id);
  }

  @Post('select')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  selectCountryPlatform(
    @Request() req: any,
    @Body() dto: { country: string; platform: string },
  ) {
    return this.subs.selectCountryPlatform(req.user.id, dto.country, dto.platform);
  }
}
