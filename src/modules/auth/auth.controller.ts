import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../core/guards/jwt-auth.guard';
import { AuthService, AcceptInvitationResult, UserLoginResult, CompanyResult } from './auth.service';
import { UserLoginDto } from './dto/user-login.dto';
import { UserRefreshDto } from './dto/user-refresh.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { SwitchCompanyDto } from './dto/switch-company.dto';

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
      activeCompanyId: r.companyId ?? null,
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
