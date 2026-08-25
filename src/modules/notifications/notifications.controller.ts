import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../core/guards/jwt-auth.guard';
import { ActiveCompanyGuard } from '../core/guards/active-company.guard';
import { CompanyAccessGuard } from '../core/guards/company-access.guard';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveCompanyGuard, CompanyAccessGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /** POST /notifications/tokens — registra o token push do dispositivo. */
  @Post('tokens')
  registerToken(
    @Req() r: any,
    @Body() body: { token: string; platform?: 'ANDROID' | 'IOS' },
  ) {
    return this.notificationsService.registerToken(
      r.company.id,
      r.user.id,
      body,
    );
  }

  /** GET /notifications/unread-count — quantidade de não lidas (badge). */
  @Get('unread-count')
  unreadCount(@Req() r: any) {
    return this.notificationsService.unreadCount(r.company.id);
  }

  /** GET /notifications — lista as notificações da empresa ativa. */
  @Get()
  list(@Req() r: any, @Query('limit') limit?: string) {
    return this.notificationsService.list(
      r.company.id,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  /** PATCH /notifications/:id/read — marca como lida. */
  @Patch(':id/read')
  markRead(@Req() r: any, @Param('id') id: string) {
    return this.notificationsService.markRead(r.company.id, id);
  }
}