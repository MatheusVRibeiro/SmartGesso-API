import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../core/guards/jwt-auth.guard';
import { ActiveCompanyGuard } from '../core/guards/active-company.guard';
import { PrismaService } from '../../database/prisma.service';

@ApiTags('company-dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ActiveCompanyGuard)
@Controller('company/dashboard')
export class CompanyDashboardController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('metrics')
  @ApiOperation({ summary: 'Métricas do dashboard da empresa' })
  async metrics(@Req() r: any) {
    const companyId = r.company.id;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // 1. A receber: soma de pagamentos PENDENTES
    const pendingPayments = await this.prisma.payment.aggregate({
      where: { companyId, status: 'PENDENTE', deletedAt: null },
      _sum: { amount: true },
      _count: true,
    });

    // 2. Serviços do dia: OS agendadas para hoje (PENDENTE/EM_ANDAMENTO)
    const todayServices = await this.prisma.serviceOrder.count({
      where: {
        companyId,
        deletedAt: null,
        scheduledDate: { gte: todayStart, lte: todayEnd },
        status: { in: ['PENDENTE', 'EM_ANDAMENTO'] },
      },
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
        total: Number(pendingPayments._sum.amount ?? 0),
        count: pendingPayments._count,
      },
      todayServices: {
        count: todayServices,
      },
      recentQuotes: recentQuotes.map((q) => ({
        ...q,
        total: Number(q.total),
      })),
      stockAlerts: stockAlerts.map((m) => ({
        ...m,
        stockQty: Number(m.stockQty),
        minStockQty: Number(m.minStockQty),
      })),
    };
  }
}