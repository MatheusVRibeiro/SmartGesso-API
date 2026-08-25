import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../core/guards/jwt-auth.guard';
import { ActiveCompanyGuard } from '../core/guards/active-company.guard';
import { CompanyAccessGuard } from '../core/guards/company-access.guard';
import { PrismaService } from '../../database/prisma.service';
import { PerformanceService } from './performance.service';

@ApiTags('company-dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveCompanyGuard, CompanyAccessGuard)
@Controller('company/dashboard')
export class CompanyDashboardController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly performanceService: PerformanceService,
  ) {}

  @Get('performance')
  @ApiOperation({
    summary:
      'Performance mensal por vendedor: totais, % vs meta e divisão por membro',
  })
  async performance(
    @Req() r: any,
    @Query('year') year?: string,
    @Query('month') month?: string,
  ) {
    const y = Number(year);
    const m = Number(month);
    if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) {
      throw new BadRequestException(
        'year e month são obrigatórios (month entre 1 e 12)',
      );
    }
    return this.performanceService.getPerformance(r.company.id, y, m);
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Métricas do dashboard da empresa' })
  async metrics(@Req() r: any) {
    const companyId = r.company.id;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthEnd = new Date();
    monthEnd.setMonth(monthEnd.getMonth() + 1, 0);
    monthEnd.setHours(23, 59, 59, 999);

    // 1. A receber: soma de pagamentos PENDENTES
    const pendingPaymentsAgg = await this.prisma.payment.aggregate({
      where: { companyId, status: 'PENDENTE', deletedAt: null },
      _sum: { amount: true },
      _count: true,
    });

    // 1b. Pagamentos pendentes: últimos 5 por vencimento
    const pendingPaymentsList = await this.prisma.payment.findMany({
      where: { companyId, status: 'PENDENTE', deletedAt: null },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      take: 5,
      select: {
        id: true,
        amount: true,
        dueDate: true,
        client: { select: { id: true, name: true } },
      },
    });

    // 2. Serviços do dia: OS agendadas para hoje (PENDENTE/EM_ANDAMENTO)
    const todayServicesCount = await this.prisma.serviceOrder.count({
      where: {
        companyId,
        deletedAt: null,
        scheduledDate: { gte: todayStart, lte: todayEnd },
        status: { in: ['PENDENTE', 'EM_ANDAMENTO'] },
      },
    });

    // 2b. Lista dos próximos 5 serviços de hoje
    const todayServicesList = await this.prisma.serviceOrder.findMany({
      where: {
        companyId,
        deletedAt: null,
        scheduledDate: { gte: todayStart, lte: todayEnd },
        status: { in: ['PENDENTE', 'EM_ANDAMENTO'] },
      },
      orderBy: { scheduledDate: 'asc' },
      take: 5,
      select: {
        id: true,
        code: true,
        status: true,
        scheduledDate: true,
        client: { select: { id: true, name: true } },
        work: { select: { id: true, name: true } },
      },
    });

    // 2c. Orçamentos abertos: RASCUNHO ou ENVIADO
    const openQuotesCount = await this.prisma.quote.count({
      where: { companyId, deletedAt: null, status: { in: ['RASCUNHO', 'ENVIADO'] } },
    });

    // 2d. Despesas do mês corrente
    const monthExpenses = await this.prisma.expense.aggregate({
      where: {
        companyId,
        deletedAt: null,
        expenseDate: { gte: monthStart, lte: monthEnd },
      },
      _sum: { amount: true },
      _count: true,
    });

    // 3. Orçamentos recentes: últimos 5 (não cancelados)
    const recentQuotes = await this.prisma.quote.findMany({
      where: { companyId, deletedAt: null, status: { not: 'CANCELADO' } },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        quoteNumber: true,
        version: true,
        status: true,
        total: true,
        createdAt: true,
        client: { select: { id: true, name: true } },
      },
    });

    // 4. Alertas de estoque: materiais com stockQty < minStockQty
    const stockAlerts = await this.prisma.material.findMany({
      where: {
        companyId,
        deletedAt: null,
        status: 'ACTIVE',
        stockQty: { lt: this.prisma.material.fields.minStockQty },
      },
      orderBy: { name: 'asc' },
      take: 10,
      select: {
        id: true,
        name: true,
        unit: true,
        stockQty: true,
        minStockQty: true,
      },
    });

    return {
      toReceive: {
        total: Number(pendingPaymentsAgg._sum.amount ?? 0),
        count: pendingPaymentsAgg._count,
      },
      todayServices: {
        count: todayServicesCount,
        list: todayServicesList,
      },
      openQuotes: {
        count: openQuotesCount,
      },
      monthExpenses: {
        total: Number(monthExpenses._sum.amount ?? 0),
        count: monthExpenses._count,
      },
      recentQuotes: recentQuotes.map((q) => ({
        ...q,
        total: Number(q.total),
      })),
      pendingPayments: pendingPaymentsList.map((p) => ({
        ...p,
        amount: Number(p.amount),
      })),
      stockAlerts: stockAlerts.map((m) => ({
        ...m,
        stockQty: Number(m.stockQty),
        minStockQty: Number(m.minStockQty),
      })),
    };
  }
}