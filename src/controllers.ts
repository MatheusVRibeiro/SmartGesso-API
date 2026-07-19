import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PlatformAdminGuard } from './modules/core/guards/platform-admin.guard';
import { JwtAuthGuard } from './modules/core/guards/jwt-auth.guard';
import { ActiveCompanyGuard } from './modules/core/guards/active-company.guard';
import { CompanyAccessGuard } from './modules/core/guards/company-access.guard';
import { PermissionsGuard } from './modules/core/guards/permissions.guard';
import { AuthService, PlatformLoginResult, AcceptInvitationResult, UserLoginResult, CompanyResult } from './modules/auth/auth.service';
import { BusinessService } from './business.service';
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
  @Post('login') login(@Body() b: any): Promise<PlatformLoginResult> {
    return this.auth.platformLogin(b.email, b.password);
  }
  @Post('refresh') refresh(@Body() b: any) {
    return this.auth.platformRefresh(b.refreshToken);
  }
  @Post('logout') logout(@Req() req: any) {
    if (req.platformAdmin) {
      return this.auth.platformLogout(req.platformAdmin.id);
    }
    return { ok: true };
  }
  @UseGuards(PlatformAdminGuard) @ApiBearerAuth() @Get('me') me(@Req() req: any) {
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
  @Post() create(@Body() b: any) {
    return this.biz.createCompany(b);
  }
  @Get() list() {
    return this.biz.listCompanies();
  }
  @Get(':id') get(@Param('id') id: string) {
    return this.biz.company(id);
  }
  @Patch(':id') patch(@Param('id') id: string, @Body() b: any) {
    return this.biz.updateCompany(id, b);
  }
  @Post(':id/suspend') suspend(@Param('id') id: string) {
    return this.biz.setCompanyStatus(id, 'SUSPENDED');
  }
  @Post(':id/reactivate') reactivate(@Param('id') id: string) {
    return this.biz.setCompanyStatus(id, 'ACTIVE');
  }
  @Post(':id/block') block(@Param('id') id: string) {
    return this.biz.setCompanyStatus(id, 'BLOCKED');
  }
  @Post(':id/owner-invitations') invite(@Param('id') id: string, @Body() b: any) {
    return this.biz.inviteOwner(id, b);
  }
  @Post(':id/resend-owner-invitation') resend(@Param('id') id: string, @Body() b: any) {
    return this.biz.inviteOwner(id, b);
  }
  @Post(':companyId/subscriptions') sub(
    @Param('companyId') companyId: string,
    @Body() b: any,
    @Req() req: any,
  ) {
    return this.biz.createSubscription(companyId, b, req.platformAdmin.id);
  }
  @Get(':companyId/subscriptions') subs(@Param('companyId') companyId: string) {
    return this.biz.listCompanySubscriptions(companyId);
  }
}
@ApiTags('platform-plans')
@ApiBearerAuth()
@UseGuards(PlatformAdminGuard)
@Controller('platform/plans')
export class PlansController {
  constructor(private biz: BusinessService) {}
  @Post() create(@Body() b: any) {
    return this.biz.createPlan(b);
  }
  @Get() list() {
    return this.biz.listPlans();
  }
  @Get(':id') get(@Param('id') id: string) {
    return this.biz.plan(id);
  }
  @Patch(':id') patch(@Param('id') id: string, @Body() b: any) {
    return this.biz.updatePlan(id, b);
  }
}
@ApiTags('platform-subscriptions')
@ApiBearerAuth()
@UseGuards(PlatformAdminGuard)
@Controller('platform')
export class SubscriptionsController {
  constructor(private biz: BusinessService) {}
  @Get('subscriptions/:id') get(@Param('id') id: string) {
    return this.biz.subscription(id);
  }
  @Patch('subscriptions/:id') patch(@Param('id') id: string, @Body() b: any) {
    return this.biz.updateSubscription(id, b);
  }
  @Post('subscriptions/:id/renew') renew(@Param('id') id: string, @Body() b: any, @Req() r: any) {
    return this.biz.renew(id, b, r.platformAdmin.id);
  }
  @Post('subscriptions/:id/suspend') suspend(@Param('id') id: string, @Req() r: any) {
    return this.biz.setSubscriptionStatus(id, 'SUSPENDED', 'manual.suspend', r.platformAdmin.id);
  }
  @Post('subscriptions/:id/reactivate') react(@Param('id') id: string, @Req() r: any) {
    return this.biz.setSubscriptionStatus(id, 'ACTIVE', 'manual.reactivate', r.platformAdmin.id);
  }
  @Post('subscriptions/:id/cancel') cancel(@Param('id') id: string, @Req() r: any) {
    return this.biz.setSubscriptionStatus(id, 'CANCELLED', 'manual.cancel', r.platformAdmin.id);
  }
  @Post('subscriptions/:id/installments/generate') gen(@Param('id') id: string, @Body() b: any) {
    return this.biz.generateInstallments(id, b);
  }
  @Get('subscriptions/:id/installments') inst(@Param('id') id: string) {
    return this.biz.listInstallments(id);
  }
  @Patch('subscription-installments/:id') patchInst(@Param('id') id: string, @Body() b: any) {
    return this.biz.updateInstallment(id, b);
  }
  @Post('subscription-installments/:id/payments') pay(
    @Param('id') id: string,
    @Body() b: any,
    @Req() r: any,
  ) {
    return this.biz.payInstallment(id, b, r.platformAdmin.id);
  }
  @Post('subscription-installments/:id/cancel') cancelInst(@Param('id') id: string) {
    return this.biz.cancelInstallment(id);
  }
}
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}
  @Post('accept-invitation') accept(@Body() b: any): Promise<AcceptInvitationResult> {
    return this.auth.acceptInvitation(b.token, b.password);
  }
  @Post('login') login(@Body() b: any): Promise<UserLoginResult> {
    return this.auth.userLogin(b.email, b.password);
  }
  @Post('refresh') refresh(@Body() b: any) {
    return this.auth.userRefresh(b.refreshToken);
  }
  @Post('logout') logout(@Req() req: any) {
    return this.auth.userLogout(req.user.id);
  }
  @Post('logout-all') logoutAll(@Req() req: any) {
    return this.auth.userLogoutAll(req.user.id);
  }
  @Post('forgot-password') forgot() {
    return { ok: true };
  }
  @Post('reset-password') reset() {
    return { ok: true };
  }
  @UseGuards(JwtAuthGuard) @ApiBearerAuth() @Get('me') me(@Req() r: any) {
    return {
      id: r.user.id,
      name: r.user.name,
      email: r.user.email,
      activeCompanyId: r.user.activeCompanyId,
    };
  }
  @UseGuards(JwtAuthGuard) @ApiBearerAuth() @Get('companies') companies(@Req() r: any): Promise<CompanyResult[]> {
    return this.auth.companies(r.user.id);
  }
  @UseGuards(JwtAuthGuard) @ApiBearerAuth() @Post('switch-company') sw(
    @Req() r: any,
    @Body() b: any,
  ) {
    return this.auth.switchCompany(r.user.id, b.companyId);
  }
}
@ApiTags('company')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveCompanyGuard)
@Controller('company')
export class CompanyController {
  constructor(private biz: BusinessService) {}
  @Get('access-status') access(@Req() r: any) {
    return this.biz.accessStatus(r.company.id);
  }
  @Get('permissions') perms(@Req() r: any) {
    return { permissions: r.member.permissions };
  }
  @UseGuards(CompanyAccessGuard, PermissionsGuard) @Get('profile') profile(@Req() r: any) {
    return r.company;
  }
  @UseGuards(CompanyAccessGuard, PermissionsGuard) @Patch('profile') patch(
    @Req() r: any,
    @Body() b: any,
  ) {
    return this.biz.updateCompany(r.company.id, b);
  }
  @UseGuards(CompanyAccessGuard, PermissionsGuard) @Get('branding') branding(@Req() r: any) {
    return this.biz.branding(r.company.id);
  }
  @UseGuards(CompanyAccessGuard, PermissionsGuard) @Patch('branding') patchBranding(
    @Req() r: any,
    @Body() b: any,
  ) {
    return this.biz.branding(r.company.id, b);
  }
}
