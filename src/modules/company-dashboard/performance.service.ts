import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/**
 * Performance mensal por vendedor (dashboard).
 *
 * Métricas do período (year/month):
 * - quotesCreated: orçamentos criados no mês (createdAt no mês, não excluídos)
 * - quotesApproved: orçamentos com status APROVADO (estado atual)
 * - approvalRate: quotesApproved / quotesCreated (0-100, 2 casas; null se 0 criados)
 * - revenue: soma de `saleValue` das OS do mês com status != CANCELADA
 * - followUpsDone: follow-ups com doneAt no mês
 *
 * byMember:
 * - O modelo `Quote` NÃO possui campo `createdById` (verificado no schema —
 *   apenas QuoteFollowUp e ServiceAdditional têm), então a divisão por
 *   vendedor usa `QuoteFollowUp.createdById` (follow-ups feitos no mês) e
 *   `CompanyMember` (nome/role). Orçamentos e OS não são atribuíveis a um
 *   vendedor individual no schema atual — por isso `quotesCreated`/
 *   `quotesApproved`/`revenue` por membro ficam 0/null e apenas
 *   `followUpsDone` é preenchido. Documentado para o frontend.
 */
@Injectable()
export class PerformanceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Performance do período (year/month) para a empresa.
   * `year`/`month` são validados no controller (inteiros, 1-12).
   */
  async getPerformance(companyId: string, year: number, month: number) {
    const { start, end } = this.periodRange(year, month);

    // 1. Orçamentos criados no mês
    const quotesCreated = await this.prisma.quote.count({
      where: {
        companyId,
        deletedAt: null,
        createdAt: { gte: start, lte: end },
      },
    });

    // 2. Orçamentos aprovados (estado atual APROVADO, não excluídos)
    const quotesApproved = await this.prisma.quote.count({
      where: {
        companyId,
        deletedAt: null,
        status: 'APROVADO',
      },
    });

    // 3. Receita do mês: soma de saleValue das OS não canceladas
    const revenueAgg = await this.prisma.serviceOrder.aggregate({
      where: {
        companyId,
        deletedAt: null,
        status: { not: 'CANCELADA' },
        createdAt: { gte: start, lte: end },
      },
      _sum: { saleValue: true },
    });

    // 4. Follow-ups concluídos no mês (doneAt no período)
    const followUpsDone = await this.prisma.quoteFollowUp.count({
      where: {
        companyId,
        deletedAt: null,
        doneAt: { gte: start, lte: end },
      },
    });

    // 5. Meta do período (null se não existir)
    const goal = await this.prisma.companyGoal.findFirst({
      where: { companyId, year, month },
    });

    // 6. Membros ativos da empresa (para nome/role no byMember)
    const members = await this.prisma.companyMember.findMany({
      where: { companyId, status: 'ATIVO' },
      include: { user: { select: { id: true, name: true } } },
    });

    // 7. Follow-ups concluídos no mês por usuário (QuoteFollowUp.createdById)
    const followUpsByUser = await this.prisma.quoteFollowUp.groupBy({
      by: ['createdById'],
      where: {
        companyId,
        deletedAt: null,
        doneAt: { gte: start, lte: end },
      },
      _count: { _all: true },
    });

    const followUpsByUserId = new Map<string, number>(
      followUpsByUser
        .filter((g) => g.createdById !== null)
        .map((g) => [g.createdById as string, g._count._all]),
    );

    const approvalRate =
      quotesCreated > 0
        ? Number(((quotesApproved / quotesCreated) * 100).toFixed(2))
        : null;

    const revenue = Number(revenueAgg._sum.saleValue ?? 0);

    // Pct vs meta (null quando não há meta ou meta = 0)
    const pct = (actual: number, target: number | null | undefined) =>
      target !== null && target !== undefined && target > 0
        ? Number(((actual / target) * 100).toFixed(2))
        : null;

    const totalQuoteAmount = await this.quoteAmountInPeriod(
      companyId,
      start,
      end,
    );

    return {
      period: { year, month },
      totals: {
        quotesCreated,
        quotesApproved,
        approvalRate,
        revenue,
        followUpsDone,
      },
      goals:
        goal === null
          ? {
              targetQuoteAmount: null,
              targetRevenue: null,
              targetApprovedQuotes: null,
              quoteAmountPct: null,
              revenuePct: null,
              approvedQuotesPct: null,
            }
          : {
              targetQuoteAmount: Number(goal.targetQuoteAmount),
              targetRevenue: Number(goal.targetRevenue),
              targetApprovedQuotes: goal.targetApprovedQuotes,
              quoteAmountPct: pct(totalQuoteAmount, Number(goal.targetQuoteAmount)),
              revenuePct: pct(revenue, Number(goal.targetRevenue)),
              approvedQuotesPct: pct(
                quotesApproved,
                goal.targetApprovedQuotes,
              ),
            },
      byMember: members.map((m) => ({
        memberId: m.id,
        memberName: m.user.name,
        role: m.role,
        // Quote não tem createdById no schema — não atribuível por vendedor.
        quotesCreated: 0,
        quotesApproved: 0,
        approvalRate: null,
        revenue: 0,
        followUpsDone: followUpsByUserId.get(m.userId) ?? 0,
      })),
    };
  }

  /** Soma de `total` dos orçamentos criados no período (não excluídos). */
  private async quoteAmountInPeriod(
    companyId: string,
    start: Date,
    end: Date,
  ): Promise<number> {
    const agg = await this.prisma.quote.aggregate({
      where: {
        companyId,
        deletedAt: null,
        createdAt: { gte: start, lte: end },
      },
      _sum: { total: true },
    });
    return Number(agg._sum.total ?? 0);
  }

  /** Início/fim do mês (fuso local do servidor — consistente com o dashboard). */
  private periodRange(year: number, month: number) {
    const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const end = new Date(year, month, 0, 23, 59, 59, 999);
    return { start, end };
  }
}
