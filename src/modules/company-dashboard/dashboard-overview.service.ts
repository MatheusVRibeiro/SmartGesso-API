import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface DashboardOverviewResponse {
  company: {
    id: string;
    tradeName?: string;
  };
  period: {
    currentYear: number;
    currentMonth: number;
    formattedPeriod: string;
  };
  summary: {
    toReceive: {
      total: number;
      overdue: number;
      dueToday: number;
      pendingCount: number;
      overdueCount: number;
    };
    revenue: {
      monthRevenue: number;
      monthExpenses: number;
      monthProfit: number;
      profitMarginPct: number;
    };
    quotes: {
      openCount: number;
      openTotal: number;
      monthApprovedCount: number;
      conversionRatePct: number | null;
    };
  };
  goals: {
    hasGoal: boolean;
    targetRevenue: number | null;
    revenuePct: number | null;
    targetApprovedQuotes: number | null;
    approvedQuotesPct: number | null;
    targetQuoteAmount: number | null;
    quoteAmountPct: number | null;
  };
  charts: {
    monthlyEvolution: Array<{
      monthLabel: string;
      year: number;
      month: number;
      revenue: number;
      expenses: number;
      profit: number;
      approvedQuotes: number;
    }>;
  };
  operationalToday: {
    servicesCount: number;
    services: Array<{
      id: string;
      code: number;
      status: string;
      scheduledDate: Date | null;
      saleValue: number;
      client: {
        id: string;
        name: string;
        phone: string | null;
        whatsapp: string | null;
      } | null;
      work: {
        id: string;
        name: string;
      } | null;
    }>;
    visitsCount: number;
    visits: Array<{
      id: string;
      type: string;
      title: string;
      time: string | null;
      quoteId: string | null;
      serviceOrderId: string | null;
      client: {
        id: string;
        name: string;
        phone: string | null;
        whatsapp: string | null;
      } | null;
      notes: string | null;
    }>;
    followUpsCount: number;
    followUps: Array<{
      id: string;
      quoteId: string;
      quoteNumber: number;
      type: string;
      notes: string | null;
      scheduledAt: Date | null;
      status: string;
      client: {
        id: string;
        name: string;
        phone: string | null;
        whatsapp: string | null;
        whatsAppUrl: string | null;
      } | null;
    }>;
  };
  alerts: {
    stockLowCount: number;
    stockAlerts: Array<{
      id: string;
      name: string;
      unit: string;
      stockQty: number;
      minStockQty: number;
      suggestedRestockQty: number;
    }>;
    recentQuotes: Array<{
      id: string;
      quoteNumber: number;
      version: number;
      status: string;
      total: number;
      createdAt: Date;
      client: {
        id: string;
        name: string;
      } | null;
    }>;
  };
}

const MONTH_NAMES = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

@Injectable()
export class DashboardOverviewService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Consolida todos os indicadores essenciais da Dashboard em uma única resposta de alto desempenho.
   */
  async getOverview(companyId: string): Promise<DashboardOverviewResponse> {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12

    // Datas base
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const monthStart = new Date(currentYear, currentMonth - 1, 1, 0, 0, 0, 0);
    const monthEnd = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Executar consultas agregadas em paralelo
    const [
      company,
      pendingPaymentsAgg,
      overduePaymentsAgg,
      dueTodayPaymentsAgg,
      monthRevenueAgg,
      monthExpensesAgg,
      openQuotesAgg,
      quotesLast30Days,
      quotesApprovedLast30Days,
      monthGoal,
      todayServices,
      pendingFollowUps,
      stockLowMaterials,
      recentQuotes,
      todayScheduleEvents,
      todayVisitsQuotes,
      monthlyEvolution,
    ] = await Promise.all([
      // 1. Dados da empresa
      this.prisma.company.findUnique({
        where: { id: companyId },
        select: { id: true, tradeName: true },
      }),

      // 2. Total a receber (geral pendente)
      this.prisma.payment.aggregate({
        where: { companyId, status: 'PENDENTE', deletedAt: null },
        _sum: { amount: true },
        _count: true,
      }),

      // 3. A receber vencido
      this.prisma.payment.aggregate({
        where: {
          companyId,
          status: 'PENDENTE',
          deletedAt: null,
          dueDate: { lt: todayStart },
        },
        _sum: { amount: true },
        _count: true,
      }),

      // 4. A receber que vence hoje
      this.prisma.payment.aggregate({
        where: {
          companyId,
          status: 'PENDENTE',
          deletedAt: null,
          dueDate: { gte: todayStart, lte: todayEnd },
        },
        _sum: { amount: true },
        _count: true,
      }),

      // 5. Faturamento do mês (OS concluída ou em andamento / não cancelada)
      this.prisma.serviceOrder.aggregate({
        where: {
          companyId,
          deletedAt: null,
          status: { not: 'CANCELADA' },
          createdAt: { gte: monthStart, lte: monthEnd },
        },
        _sum: { saleValue: true },
      }),

      // 6. Despesas do mês
      this.prisma.expense.aggregate({
        where: {
          companyId,
          deletedAt: null,
          expenseDate: { gte: monthStart, lte: monthEnd },
        },
        _sum: { amount: true },
      }),

      // 7. Orçamentos abertos (negociação em andamento)
      this.prisma.quote.aggregate({
        where: {
          companyId,
          deletedAt: null,
          status: {
            in: ['RASCUNHO', 'PRONTO_PARA_ENVIAR', 'ENVIADO', 'AGUARDANDO_APROVACAO'],
          },
        },
        _sum: { total: true },
        _count: true,
      }),

      // 8. Total de orçamentos criados nos últimos 30 dias (para taxa de conversão)
      this.prisma.quote.count({
        where: {
          companyId,
          deletedAt: null,
          createdAt: { gte: thirtyDaysAgo },
        },
      }),

      // 9. Orçamentos aprovados nos últimos 30 dias
      this.prisma.quote.count({
        where: {
          companyId,
          deletedAt: null,
          status: 'APROVADO',
          createdAt: { gte: thirtyDaysAgo },
        },
      }),

      // 10. Meta do mês corrente
      this.prisma.companyGoal.findFirst({
        where: { companyId, year: currentYear, month: currentMonth },
      }),

      // 11. Serviços de hoje
      this.prisma.serviceOrder.findMany({
        where: {
          companyId,
          deletedAt: null,
          scheduledDate: { gte: todayStart, lte: todayEnd },
          status: { in: ['PENDENTE', 'EM_ANDAMENTO'] },
        },
        orderBy: { scheduledDate: 'asc' },
        take: 10,
        select: {
          id: true,
          code: true,
          status: true,
          scheduledDate: true,
          saleValue: true,
          client: {
            select: { id: true, name: true, phone: true, whatsapp: true },
          },
          work: {
            select: { id: true, name: true },
          },
        },
      }),

      // 12. Follow-ups pendentes para hoje ou atrasados
      this.prisma.quoteFollowUp.findMany({
        where: {
          companyId,
          deletedAt: null,
          status: 'PENDING',
          OR: [
            { scheduledAt: { lte: todayEnd } },
            { scheduledAt: null },
          ],
        },
        orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'desc' }],
        take: 5,
        select: {
          id: true,
          quoteId: true,
          type: true,
          notes: true,
          scheduledAt: true,
          status: true,
          quote: {
            select: {
              quoteNumber: true,
              client: {
                select: { id: true, name: true, phone: true, whatsapp: true },
              },
            },
          },
        },
      }),

      // 13. Materiais em alerta de estoque
      this.prisma.material.findMany({
        where: {
          companyId,
          deletedAt: null,
          status: 'ACTIVE',
        },
        orderBy: { name: 'asc' },
        take: 50,
        select: {
          id: true,
          name: true,
          unit: true,
          stockQty: true,
          minStockQty: true,
        },
      }),

      // 14. Orçamentos recentes
      this.prisma.quote.findMany({
        where: { companyId, deletedAt: null },
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
      }),

      // 15. Eventos da Agenda de hoje (visitas, medições, compromissos)
      this.prisma.scheduleEvent.findMany({
        where: {
          companyId,
          deletedAt: null,
          date: { gte: todayStart, lte: todayEnd },
          status: 'AGENDADO',
        },
        orderBy: { time: 'asc' },
        take: 10,
        select: {
          id: true,
          type: true,
          title: true,
          time: true,
          quoteId: true,
          serviceOrderId: true,
          notes: true,
          client: { select: { id: true, name: true, phone: true, whatsapp: true } },
        },
      }),

      // 16. Orçamentos com data de visita técnica ou medição hoje
      this.prisma.quote.findMany({
        where: {
          companyId,
          deletedAt: null,
          OR: [
            { visitDate: { gte: todayStart, lte: todayEnd } },
            { measurementDate: { gte: todayStart, lte: todayEnd } },
          ],
        },
        take: 10,
        select: {
          id: true,
          quoteNumber: true,
          visitDate: true,
          measurementDate: true,
          client: { select: { id: true, name: true, phone: true, whatsapp: true } },
        },
      }),

      // 17. Série histórica dos últimos 6 meses
      this.getMonthlyEvolutionData(companyId, currentYear, currentMonth),
    ]);

    // Cálculos financeiros
    const monthRevenue = Number(monthRevenueAgg._sum.saleValue ?? 0);
    const monthExpenses = Number(monthExpensesAgg._sum.amount ?? 0);
    const monthProfit = monthRevenue - monthExpenses;
    const profitMarginPct =
      monthRevenue > 0
        ? Number(((monthProfit / monthRevenue) * 100).toFixed(2))
        : 0;

    // Conversão
    const conversionRatePct =
      quotesLast30Days > 0
        ? Number(((quotesApprovedLast30Days / quotesLast30Days) * 100).toFixed(2))
        : null;

    // Metas
    const targetRevenue = monthGoal ? Number(monthGoal.targetRevenue) : null;
    const targetApprovedQuotes = monthGoal?.targetApprovedQuotes ?? null;
    const targetQuoteAmount = monthGoal ? Number(monthGoal.targetQuoteAmount) : null;

    const revenuePct =
      targetRevenue && targetRevenue > 0
        ? Number(((monthRevenue / targetRevenue) * 100).toFixed(2))
        : null;

    const approvedQuotesPct =
      targetApprovedQuotes && targetApprovedQuotes > 0
        ? Number(((quotesApprovedLast30Days / targetApprovedQuotes) * 100).toFixed(2))
        : null;

    const openQuotesTotal = Number(openQuotesAgg._sum.total ?? 0);
    const quoteAmountPct =
      targetQuoteAmount && targetQuoteAmount > 0
        ? Number(((openQuotesTotal / targetQuoteAmount) * 100).toFixed(2))
        : null;

    // Filtro de estoque em memória para precisão com Decimals
    const lowStockFiltered = stockLowMaterials
      .map((m) => {
        const stock = Number(m.stockQty ?? 0);
        const min = Number(m.minStockQty ?? 0);
        return {
          id: m.id,
          name: m.name,
          unit: m.unit,
          stockQty: stock,
          minStockQty: min,
          suggestedRestockQty: Math.max(0, min * 2 - stock),
        };
      })
      .filter((m) => m.minStockQty > 0 && m.stockQty < m.minStockQty)
      .slice(0, 10);

    // Follow-ups com link rápido para WhatsApp
    const followUpsFormatted = pendingFollowUps.map((fu) => {
      const client = fu.quote?.client;
      const phoneDigits = (client?.whatsapp || client?.phone || '').replace(/\D/g, '');
      const whatsAppUrl =
        phoneDigits.length >= 10
          ? `https://wa.me/55${phoneDigits}?text=${encodeURIComponent(
              `Olá ${client?.name || ''}, tudo bem? Estou entrando em contato sobre o seu orçamento #${fu.quote?.quoteNumber || ''}.`,
            )}`
          : null;

      return {
        id: fu.id,
        quoteId: fu.quoteId,
        quoteNumber: fu.quote?.quoteNumber ?? 0,
        type: fu.type,
        notes: fu.notes,
        scheduledAt: fu.scheduledAt,
        status: fu.status,
        client: client
          ? {
              id: client.id,
              name: client.name,
              phone: client.phone,
              whatsapp: client.whatsapp,
              whatsAppUrl,
            }
          : null,
      };
    });

    // Visitas técnicas e compromissos de hoje
    const visitsList: Array<{
      id: string;
      type: string;
      title: string;
      time: string | null;
      quoteId: string | null;
      serviceOrderId: string | null;
      client: {
        id: string;
        name: string;
        phone: string | null;
        whatsapp: string | null;
      } | null;
      notes: string | null;
    }> = todayScheduleEvents.map((evt) => ({
      id: evt.id,
      type: evt.type,
      title:
        evt.title ||
        (evt.type === 'VISITA'
          ? 'Visita Técnica'
          : evt.type === 'MEDICAO'
          ? 'Medição Técnica'
          : 'Compromisso'),
      time: evt.time || null,
      quoteId: evt.quoteId,
      serviceOrderId: evt.serviceOrderId,
      client: evt.client,
      notes: evt.notes,
    }));

    for (const q of todayVisitsQuotes) {
      if (
        q.visitDate &&
        !visitsList.some((v) => v.quoteId === q.id && v.type === 'VISITA')
      ) {
        const timeStr =
          q.visitDate.getHours() !== 0 || q.visitDate.getMinutes() !== 0
            ? `${String(q.visitDate.getHours()).padStart(2, '0')}:${String(
                q.visitDate.getMinutes(),
              ).padStart(2, '0')}`
            : null;
        visitsList.push({
          id: `quote-visit-${q.id}`,
          type: 'VISITA',
          title: `Visita Técnica • Orçamento #${q.quoteNumber}`,
          time: timeStr,
          quoteId: q.id,
          serviceOrderId: null,
          client: q.client,
          notes: null,
        });
      }
      if (
        q.measurementDate &&
        !visitsList.some((v) => v.quoteId === q.id && v.type === 'MEDICAO')
      ) {
        const timeStr =
          q.measurementDate.getHours() !== 0 || q.measurementDate.getMinutes() !== 0
            ? `${String(q.measurementDate.getHours()).padStart(2, '0')}:${String(
                q.measurementDate.getMinutes(),
              ).padStart(2, '0')}`
            : null;
        visitsList.push({
          id: `quote-medicao-${q.id}`,
          type: 'MEDICAO',
          title: `Medição Técnica • Orçamento #${q.quoteNumber}`,
          time: timeStr,
          quoteId: q.id,
          serviceOrderId: null,
          client: q.client,
          notes: null,
        });
      }
    }

    return {
      company: {
        id: companyId,
        tradeName: company?.tradeName,
      },
      period: {
        currentYear,
        currentMonth,
        formattedPeriod: `${MONTH_NAMES[currentMonth - 1]} / ${currentYear}`,
      },
      summary: {
        toReceive: {
          total: Number(pendingPaymentsAgg._sum.amount ?? 0),
          overdue: Number(overduePaymentsAgg._sum.amount ?? 0),
          dueToday: Number(dueTodayPaymentsAgg._sum.amount ?? 0),
          pendingCount: pendingPaymentsAgg._count,
          overdueCount: overduePaymentsAgg._count,
        },
        revenue: {
          monthRevenue,
          monthExpenses,
          monthProfit,
          profitMarginPct,
        },
        quotes: {
          openCount: openQuotesAgg._count,
          openTotal: openQuotesTotal,
          monthApprovedCount: quotesApprovedLast30Days,
          conversionRatePct,
        },
      },
      goals: {
        hasGoal: !!monthGoal,
        targetRevenue,
        revenuePct,
        targetApprovedQuotes,
        approvedQuotesPct,
        targetQuoteAmount,
        quoteAmountPct,
      },
      charts: {
        monthlyEvolution,
      },
      operationalToday: {
        servicesCount: todayServices.length,
        services: todayServices.map((s) => ({
          id: s.id,
          code: s.code,
          status: s.status,
          scheduledDate: s.scheduledDate,
          saleValue: Number(s.saleValue ?? 0),
          client: s.client,
          work: s.work,
        })),
        visitsCount: visitsList.length,
        visits: visitsList,
        followUpsCount: followUpsFormatted.length,
        followUps: followUpsFormatted,
      },
      alerts: {
        stockLowCount: lowStockFiltered.length,
        stockAlerts: lowStockFiltered,
        recentQuotes: recentQuotes.map((q) => ({
          ...q,
          total: Number(q.total),
        })),
      },
    };
  }

  /**
   * Constrói a série dos últimos 6 meses para visualização gráfica.
   */
  private async getMonthlyEvolutionData(
    companyId: string,
    currentYear: number,
    currentMonth: number,
  ) {
    const monthsList: Array<{ year: number; month: number; start: Date; end: Date }> = [];

    // Gerar os últimos 6 meses
    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - 1 - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
      const end = new Date(y, m, 0, 23, 59, 59, 999);
      monthsList.push({ year: y, month: m, start, end });
    }

    const evolutionResults = await Promise.all(
      monthsList.map(async (item) => {
        const [revAgg, expAgg, approvedCount] = await Promise.all([
          this.prisma.serviceOrder.aggregate({
            where: {
              companyId,
              deletedAt: null,
              status: { not: 'CANCELADA' },
              createdAt: { gte: item.start, lte: item.end },
            },
            _sum: { saleValue: true },
          }),
          this.prisma.expense.aggregate({
            where: {
              companyId,
              deletedAt: null,
              expenseDate: { gte: item.start, lte: item.end },
            },
            _sum: { amount: true },
          }),
          this.prisma.quote.count({
            where: {
              companyId,
              deletedAt: null,
              status: 'APROVADO',
              createdAt: { gte: item.start, lte: item.end },
            },
          }),
        ]);

        const revenue = Number(revAgg._sum.saleValue ?? 0);
        const expenses = Number(expAgg._sum.amount ?? 0);
        const profit = revenue - expenses;

        return {
          monthLabel: `${MONTH_NAMES[item.month - 1]}/${String(item.year).slice(-2)}`,
          year: item.year,
          month: item.month,
          revenue,
          expenses,
          profit,
          approvedQuotes: approvedCount,
        };
      }),
    );

    return evolutionResults;
  }
}
