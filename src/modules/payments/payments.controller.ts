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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../core/guards/jwt-auth.guard';
import { ActiveCompanyGuard } from '../core/guards/active-company.guard';
import { CompanyAccessGuard } from '../core/guards/company-access.guard';
import { PermissionsGuard } from '../core/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
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
  @UseGuards(PermissionsGuard)
  @RequirePermissions('customer_payments.read')
  @ApiOperation({ summary: 'Lista pagamentos da empresa' })
  findAll(@Req() r: any, @Query('status') status?: string) {
    return this.paymentsService.findAll(r.company.id, status);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('customer_payments.read')
  @ApiOperation({ summary: 'Busca pagamento por ID' })
  findOne(@Req() r: any, @Param('id') id: string) {
    return this.paymentsService.findOne(r.company.id, id);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermissions('customer_payments.create')
  @ApiOperation({ summary: 'Cria novo pagamento' })
  create(@Req() r: any, @Body() dto: CreatePaymentDto) {
    return this.paymentsService.create(r.company.id, dto);
  }

  @Post(':id/installments/:installmentId/pay')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('customer_payments.create')
  @ApiOperation({ summary: 'Registra pagamento de parcela' })
  payInstallment(
    @Req() r: any,
    @Param('id') id: string,
    @Param('installmentId') installmentId: string,
  ) {
    return this.paymentsService.payInstallment(r.company.id, id, installmentId);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('customer_payments.create')
  @ApiOperation({ summary: 'Atualiza pagamento' })
  update(@Req() r: any, @Param('id') id: string, @Body() dto: UpdatePaymentDto) {
    return this.paymentsService.update(r.company.id, id, dto);
  }

  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('customer_payments.reverse')
  @ApiOperation({ summary: 'Remove pagamento' })
  remove(@Req() r: any, @Param('id') id: string) {
    return this.paymentsService.remove(r.company.id, id);
  }
}
