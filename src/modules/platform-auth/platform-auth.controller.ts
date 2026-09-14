import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PlatformAdminGuard } from '../core/guards/platform-admin.guard';
import { AuthService, PlatformLoginResult } from '../auth/auth.service';
import { PlatformLoginDto } from './dto/platform-login.dto';
import { PlatformRefreshDto } from './dto/platform-refresh.dto';

@ApiTags('platform-auth')
@Controller('platform/auth')
export class PlatformAuthController {
  constructor(private auth: AuthService) {}

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  login(@Body() dto: PlatformLoginDto): Promise<PlatformLoginResult> {
    return this.auth.platformLogin(dto.email, dto.password);
  }

  @Post('refresh')
  refresh(@Body() dto: PlatformRefreshDto) {
    return this.auth.platformRefresh(dto.refreshToken);
  }

  @UseGuards(PlatformAdminGuard)
  @ApiBearerAuth()
  @Post('logout')
  logout(@Req() req: any) {
    return this.auth.platformLogout(req.platformAdmin.id);
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
