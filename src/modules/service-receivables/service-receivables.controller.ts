import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../core/guards/jwt-auth.guard';
import { ActiveCompanyGuard } from '../core/guards/active-company.guard';
import { CompanyAccessGuard } from '../core/guards/company-access.guard';
import { ServiceReceivablesService } from './service-receivables.service';
import { CreateReceivableDto } from './dto/create-receivable.dto';
import { UpdateInstallmentDto } from './dto/update-installment.dto';

@ApiTags('Service Receivables')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveCompanyGuard, CompanyAccessGuard)
@Controller()
export class ServiceReceivablesController {
  constructor(
    private readonly receivablesService: ServiceReceivablesService,
  ) {}

  @Post('service-orders/:serviceOrderId/receivables')
  @ApiOperation({ summary: 'Gerar recebíveis a partir do total da OS' })
  async generateReceivables(
    @Param('serviceOrderId') serviceOrderId: string,
    @Body() dto: CreateReceivableDto,
    @Request() req: any,
  ) {
    const companyId = req.company.id;
    return this.receivablesService.generateReceivables(
      serviceOrderId,
      companyId,
      dto,
    );
  }

  @Get('service-orders/:serviceOrderId/receivables')
  @ApiOperation({ summary: 'Listar recebíveis de uma OS' })
  async getReceivables(
    @Param('serviceOrderId') serviceOrderId: string,
    @Request() req: any,
  ) {
    const companyId = req.company.id;
    return this.receivablesService.getReceivablesByServiceOrder(
      serviceOrderId,
      companyId,
    );
  }

  @Patch('receivables/:receivableId/installments/:installmentId')
  @ApiOperation({ summary: 'Registrar pagamento de uma parcela' })
  async updateInstallment(
    @Param('receivableId') receivableId: string,
    @Param('installmentId') installmentId: string,
    @Body() dto: UpdateInstallmentDto,
    @Request() req: any,
  ) {
    const companyId = req.company.id;
    return this.receivablesService.updateInstallment(
      receivableId,
      installmentId,
      companyId,
      dto,
    );
  }
}
