import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PlatformAdminGuard } from '../core/guards/platform-admin.guard';
import { BusinessService } from '../../business.service';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { RenewSubscriptionDto } from './dto/renew-subscription.dto';
import { GenerateInstallmentsDto } from './dto/generate-installments.dto';
import { UpdateInstallmentDto } from './dto/update-installment.dto';
import { PayInstallmentDto } from './dto/pay-installment.dto';

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
