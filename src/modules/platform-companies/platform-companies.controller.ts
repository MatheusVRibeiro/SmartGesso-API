import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PlatformAdminGuard } from '../core/guards/platform-admin.guard';
import { BusinessService } from '../../business.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { InviteOwnerDto } from './dto/invite-owner.dto';
import { CreateSubscriptionDto } from '../subscriptions/dto/create-subscription.dto';

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
