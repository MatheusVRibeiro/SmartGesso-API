import {
  Body,
  Controller,
  Delete,
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
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';

@ApiTags('payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveCompanyGuard, CompanyAccessGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  findAll(@Req() r: any, @Query('status') status?: string) {
    return this.paymentsService.findAll(r.company.id, status);
  }

  @Get(':id')
  findOne(@Req() r: any, @Param('id') id: string) {
    return this.paymentsService.findOne(r.company.id, id);
  }

  @Post()
  create(@Req() r: any, @Body() dto: CreatePaymentDto) {
    return this.paymentsService.create(r.company.id, dto);
  }

  @Post(':id/installments/:installmentId/pay')
  payInstallment(
    @Req() r: any,
    @Param('id') id: string,
    @Param('installmentId') installmentId: string,
  ) {
    return this.paymentsService.payInstallment(r.company.id, id, installmentId);
  }

  @Patch(':id')
  update(@Req() r: any, @Param('id') id: string, @Body() dto: UpdatePaymentDto) {
    return this.paymentsService.update(r.company.id, id, dto);
  }

  @Delete(':id')
  remove(@Req() r: any, @Param('id') id: string) {
    return this.paymentsService.remove(r.company.id, id);
  }
}
