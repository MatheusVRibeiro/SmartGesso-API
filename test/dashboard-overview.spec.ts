import { DashboardOverviewService } from '../src/modules/company-dashboard/dashboard-overview.service';

describe('DashboardOverviewService', () => {
  let service: DashboardOverviewService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      company: {
        findUnique: jest.fn().mockResolvedValue({ id: 'comp-1', tradeName: 'Gesso Silva' }),
      },
      payment: {
        aggregate: jest.fn().mockImplementation(({ where }) => {
          if (where?.dueDate?.lt) {
            return Promise.resolve({ _sum: { amount: 500 }, _count: 1 });
          }
          if (where?.dueDate?.gte) {
            return Promise.resolve({ _sum: { amount: 300 }, _count: 1 });
          }
          return Promise.resolve({ _sum: { amount: 1500 }, _count: 3 });
        }),
      },
      serviceOrder: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { saleValue: 12000 } }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'os-1',
            code: 101,
            status: 'PENDENTE',
            scheduledDate: new Date(),
            saleValue: 1500,
            client: { id: 'cli-1', name: 'João Silva', phone: '11999999999', whatsapp: '11999999999' },
            work: { id: 'w-1', name: 'Obra Centro' },
          },
        ]),
      },
      expense: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 4000 } }),
      },
      quote: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { total: 25000 }, _count: 5 }),
        count: jest.fn().mockImplementation(({ where }) => {
          if (where?.status === 'APROVADO') return Promise.resolve(4);
          return Promise.resolve(10);
        }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'q-1',
            quoteNumber: 42,
            version: 1,
            status: 'APROVADO',
            total: 3500,
            createdAt: new Date(),
            client: { id: 'cli-1', name: 'João Silva' },
          },
        ]),
      },
      companyGoal: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'goal-1',
          targetRevenue: 20000,
          targetApprovedQuotes: 8,
          targetQuoteAmount: 30000,
        }),
      },
      quoteFollowUp: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'fu-1',
            quoteId: 'q-1',
            type: 'WHATSAPP',
            notes: 'Ligar para confirmar',
            scheduledAt: new Date(),
            status: 'PENDING',
            quote: {
              quoteNumber: 42,
              client: {
                id: 'cli-1',
                name: 'Maria Santos',
                phone: '11988887777',
                whatsapp: '11988887777',
              },
            },
          },
        ]),
      },
      scheduleEvent: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'evt-1',
            type: 'VISITA',
            title: 'Visita Técnica',
            time: '14:00',
            quoteId: 'q-1',
            serviceOrderId: null,
            client: { id: 'cli-1', name: 'João Silva', phone: '11999999999', whatsapp: '11999999999' },
            notes: 'Verificar sanca',
          },
        ]),
      },
      material: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'mat-1',
            name: 'Placa ST 12.5mm',
            unit: 'chapa',
            stockQty: 5,
            minStockQty: 20,
          },
        ]),
      },
    };

    service = new DashboardOverviewService(prisma);
  });

  it('deve retornar a estrutura consolidada da Dashboard com cálculos precisos', async () => {
    const result = await service.getOverview('comp-1');

    expect(result.company.id).toBe('comp-1');
    expect(result.company.tradeName).toBe('Gesso Silva');

    // 1. Financeiro
    expect(result.summary.toReceive.total).toBe(1500);
    expect(result.summary.toReceive.overdue).toBe(500);
    expect(result.summary.toReceive.dueToday).toBe(300);

    expect(result.summary.revenue.monthRevenue).toBe(12000);
    expect(result.summary.revenue.monthExpenses).toBe(4000);
    expect(result.summary.revenue.monthProfit).toBe(8000);
    expect(result.summary.revenue.profitMarginPct).toBe(66.67);

    // 2. Metas
    expect(result.goals.hasGoal).toBe(true);
    expect(result.goals.targetRevenue).toBe(20000);
    expect(result.goals.revenuePct).toBe(60); // 12000 / 20000 * 100
    expect(result.goals.approvedQuotesPct).toBe(50); // 4 / 8 * 100

    // 3. Gráficos (6 meses)
    expect(result.charts.monthlyEvolution).toHaveLength(6);

    // 4. Operacional de hoje
    expect(result.operationalToday.servicesCount).toBe(1);
    expect(result.operationalToday.services[0].code).toBe(101);
    expect(result.operationalToday.visitsCount).toBe(1);
    expect(result.operationalToday.visits[0].title).toBe('Visita Técnica');
    expect(result.operationalToday.followUpsCount).toBe(1);
    expect(result.operationalToday.followUps[0].client?.whatsAppUrl).toContain('wa.me/5511988887777');

    // 5. Alertas de estoque
    expect(result.alerts.stockLowCount).toBe(1);
    expect(result.alerts.stockAlerts[0].suggestedRestockQty).toBe(35); // 20*2 - 5 = 35
  });
});
