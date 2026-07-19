import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PlatformAdminGuard } from './modules/core/guards/platform-admin.guard';
import { JwtAuthGuard } from './modules/core/guards/jwt-auth.guard';
import { ActiveCompanyGuard } from './modules/core/guards/active-company.guard';
import { CompanyAccessGuard } from './modules/core/guards/company-access.guard';
import { PermissionsGuard } from './modules/core/guards/permissions.guard';
import { AuthService, PlatformLoginResult, AcceptInvitationResult, UserLoginResult, CompanyResult } from './modules/auth/auth.service';
import { BusinessService } from './business.service';

// Platform Auth DTOs
import { PlatformLoginDto } from './modules/platform-auth/dto/platform-login.dto';
import { PlatformRefreshDto } from './modules/platform-auth/dto/platform-refresh.dto';

// Platform Companies DTOs
import { CreateCompanyDto } from './modules/platform-companies/dto/create-company.dto';
import { UpdateCompanyDto } from './modules/platform-companies/dto/update-company.dto';
import { InviteOwnerDto } from './modules/platform-companies/dto/invite-owner.dto';

// Plans DTOs
import { CreatePlanDto } from './modules/plans/dto/create-plan.dto';
import { UpdatePlanDto } from './modules/plans/dto/update-plan.dto';

// Subscriptions DTOs
import { CreateSubscriptionDto } from './modules/subscriptions/dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './modules/subscriptions/dto/update-subscription.dto';
import { RenewSubscriptionDto } from './modules/subscriptions/dto/renew-subscription.dto';
import { GenerateInstallmentsDto } from './modules/subscriptions/dto/generate-installments.dto';
import { UpdateInstallmentDto } from './modules/subscriptions/dto/update-installment.dto';
import { PayInstallmentDto } from './modules/subscriptions/dto/pay-installment.dto';

// Auth DTOs
import { UserLoginDto } from './modules/auth/dto/user-login.dto';
import { UserRefreshDto } from './modules/auth/dto/user-refresh.dto';
import { AcceptInvitationDto } from './modules/auth/dto/accept-invitation.dto';
import { SwitchCompanyDto } from './modules/auth/dto/switch-company.dto';

// Companies DTOs
import { UpdateBrandingDto } from './modules/companies/dto/update-branding.dto';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get() health() {
    return { status: 'ok', app: 'SmartGesso API' };
  }
}

@ApiTags('platform-auth')
@Controller('platform/auth')
export class PlatformAuthController {
  constructor(private auth: AuthService) {}

  @Post('login')
  login(@Body() dto: PlatformLoginDto): Promise<PlatformLoginResult> {
    return this.auth.platformLogin(dto.email, dto.password);
  }

  @Post('refresh')
  refresh(@Body() dto: PlatformRefreshDto) {
    return this.auth.platformRefresh(dto.refreshToken);
  }

  @Post('logout')
  logout(@Req() req: any) {
    if (req.platformAdmin) {
      return this.auth.platformLogout(req.platformAdmin.id);
    }
    return { ok: true };
  }

  @UseGuards(PlatformAdminGuard)
  @ApiBearerAuth()
  @Get('me')
  me(@Req() req: any) {
    return {
      id: req.platformAdmin.id,
      name: req.platformAdmin.name,
      email: req.platformAdmin.email,
    };
  }
}

@ApiTags('platform-companies')
@ApiBearerAuth()
@UseGuards(PlatformAdminGuard)
@Controller('platform/companies')
export class PlatformCompaniesController {
  constructor(private biz: BusinessService) {}

  @Post()
  create(@Body() dto: CreateCompanyDto) {
    return this.biz.createCompany(dto);
  }

  @Get()
  list() {
    return this.biz.listCompanies();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.biz.company(id);
  }

  @Patch(':id')
  patch(@Param('id') id: string, @Body() dto: UpdateCompanyDto) {
    return this.biz.updateCompany(id, dto);
  }

  @Post(':id/suspend')
  suspend(@Param('id') id: string) {
    return this.biz.setCompanyStatus(id, 'SUSPENDED');
  }

  @Post(':id/reactivate')
  reactivate(@Param('id') id: string) {
    return this.biz.setCompanyStatus(id, 'ACTIVE');
  }

  @Post(':id/block')
  block(@Param('id') id: string) {
    return this.biz.setCompanyStatus(id, 'BLOCKED');
  }

  @Post(':id/owner-invitations')
  invite(@Param('id') id: string, @Body() dto: InviteOwnerDto) {
    return this.biz.inviteOwner(id, dto);
  }

  @Post(':id/resend-owner-invitation')
  resend(@Param('id') id: string, @Body() dto: InviteOwnerDto) {
    return this.biz.inviteOwner(id, dto);
  }

  @Post(':companyId/subscriptions')
  sub(
    @Param('companyId') companyId: string,
    @Body() dto: CreateSubscriptionDto,
    @Req() req: any,
  ) {
    return this.biz.createSubscription(companyId, dto, req.platformAdmin.id);
  }

  @Get(':companyId/subscriptions')
  subs(@Param('companyId') companyId: string) {
    return this.biz.listCompanySubscriptions(companyId);
  }
}

@ApiTags('platform-plans')
@ApiBearerAuth()
@UseGuards(PlatformAdminGuard)
@Controller('platform/plans')
export class PlansController {
  constructor(private biz: BusinessService) {}

  @Post()
  create(@Body() dto: CreatePlanDto) {
    return this.biz.createPlan(dto);
  }

  @Get()
  list() {
    return this.biz.listPlans();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.biz.plan(id);
  }

  @Patch(':id')
  patch(@Param('id') id: string, @Body() dto: UpdatePlanDto) {
    return this.biz.updatePlan(id, dto);
  }
}

@ApiTags('platform-subscriptions')
@ApiBearerAuth()
@UseGuards(PlatformAdminGuard)
@Controller('platform')
export class SubscriptionsController {
  constructor(private biz: BusinessService) {}

  @Get('subscriptions/:id')
  get(@Param('id') id: string) {
    return this.biz.subscription(id);
  }

  @Patch('subscriptions/:id')
  patch(@Param('id') id: string, @Body() dto: UpdateSubscriptionDto) {
    return this.biz.updateSubscription(id, dto);
  }

  @Post('subscriptions/:id/renew')
  renew(@Param('id') id: string, @Body() dto: RenewSubscriptionDto, @Req() r: any) {
    return this.biz.renew(id, dto, r.platformAdmin.id);
  }

  @Post('subscriptions/:id/suspend')
  suspend(@Param('id') id: string, @Req() r: any) {
    return this.biz.setSubscriptionStatus(id, 'SUSPENDED', 'manual.suspend', r.platformAdmin.id);
  }

  @Post('subscriptions/:id/reactivate')
  react(@Param('id') id: string, @Req() r: any) {
    return this.biz.setSubscriptionStatus(id, 'ACTIVE', 'manual.reactivate', r.platformAdmin.id);
  }

  @Post('subscriptions/:id/cancel')
  cancel(@Param('id') id: string, @Req() r: any) {
    return this.biz.setSubscriptionStatus(id, 'CANCELLED', 'manual.cancel', r.platformAdmin.id);
  }

  @Post('subscriptions/:id/installments/generate')
  gen(@Param('id') id: string, @Body() dto: GenerateInstallmentsDto) {
    return this.biz.generateInstallments(id, dto);
  }

  @Get('subscriptions/:id/installments')
  inst(@Param('id') id: string) {
    return this.biz.listInstallments(id);
  }

  @Patch('subscription-installments/:id')
  patchInst(@Param('id') id: string, @Body() dto: UpdateInstallmentDto) {
    return this.biz.updateInstallment(id, dto);
  }

  @Post('subscription-installments/:id/payments')
  pay(
    @Param('id') id: string,
    @Body() dto: PayInstallmentDto,
    @Req() r: any,
  ) {
    return this.biz.payInstallment(id, dto, r.platformAdmin.id);
  }

  @Post('subscription-installments/:id/cancel')
  cancelInst(@Param('id') id: string) {
    return this.biz.cancelInstallment(id);
  }
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('accept-invitation')
  accept(@Body() dto: AcceptInvitationDto): Promise<AcceptInvitationResult> {
    return this.auth.acceptInvitation(dto.token, dto.password);
  }

  @Post('login')
  login(@Body() dto: UserLoginDto): Promise<UserLoginResult> {
    return this.auth.userLogin(dto.email, dto.password);
  }

  @Post('refresh')
  refresh(@Body() dto: UserRefreshDto) {
    return this.auth.userRefresh(dto.refreshToken);
  }

  @Post('logout')
  logout(@Req() req: any) {
    return this.auth.userLogout(req.user.id);
  }

  @Post('logout-all')
  logoutAll(@Req() req: any) {
    return this.auth.userLogoutAll(req.user.id);
  }

  @Post('forgot-password')
  forgot() {
    return { ok: true };
  }

  @Post('reset-password')
  reset() {
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('me')
  me(@Req() r: any) {
    return {
      id: r.user.id,
      name: r.user.name,
      email: r.user.email,
      activeCompanyId: r.user.activeCompanyId,
    };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('companies')
  companies(@Req() r: any): Promise<CompanyResult[]> {
    return this.auth.companies(r.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('switch-company')
  sw(
    @Req() r: any,
    @Body() dto: SwitchCompanyDto,
  ) {
    return this.auth.switchCompany(r.user.id, dto.companyId);
  }
}

@ApiTags('company')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveCompanyGuard)
@Controller('company')
export class CompanyController {
  constructor(private biz: BusinessService) {}

  @Get('access-status')
  access(@Req() r: any) {
    return this.biz.accessStatus(r.company.id);
  }

  @Get('permissions')
  perms(@Req() r: any) {
    return { permissions: r.member.permissions };
  }

  @UseGuards(CompanyAccessGuard, PermissionsGuard)
  @Get('profile')
  profile(@Req() r: any) {
    return r.company;
  }

  @UseGuards(CompanyAccessGuard, PermissionsGuard)
  @Patch('profile')
  patch(
    @Req() r: any,
    @Body() dto: UpdateCompanyDto,
  ) {
    return this.biz.updateCompany(r.company.id, dto);
  }

  @UseGuards(CompanyAccessGuard, PermissionsGuard)
  @Get('branding')
  branding(@Req() r: any) {
    return this.biz.branding(r.company.id);
  }

  @UseGuards(CompanyAccessGuard, PermissionsGuard)
  @Patch('branding')
  patchBranding(
    @Req() r: any,
    @Body() dto: UpdateBrandingDto,
  ) {
    return this.biz.branding(r.company.id, dto);
  }
}
