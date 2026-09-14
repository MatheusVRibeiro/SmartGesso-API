import { PerformanceService } from '../src/modules/company-dashboard/performance.service';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Testes unitários do PerformanceService — performance mensal por vendedor.
 *
 * PrismaService é mockado — nenhum banco é acessado.
 *
 * Cobre: agregações do período (orçamentos, OS, follow-ups), % vs meta
 * (incluindo nulls quando não há meta ou meta = 0) e divisão por membro
 * (byMember via QuoteFollowUp.createdById — Quote não tem createdById no schema).
 */
describe('PerformanceService', () => {
  let service: PerformanceService;
  let prisma: any;

  const COMPANY_ID = 'company-1';
  const OTHER_COMPANY_ID = 'company-2';
  const USER_A = 'user-a';
  const USER_B = 'user-b';

  beforeEach(() => {
    prisma = {
      quote: {
        count: jest.fn(),
        aggregate: jest.fn(),
      },
      serviceOrder: {
        aggregate: jest.fn(),
      },
      quoteFollowUp: {
        count: jest.fn(),
        groupBy: jest.fn(),
      },
      companyGoal: {
        findFirst: jest.fn(),
      },
      companyMember: {
        findMany: jest.fn(),
      },
    };
    service = new PerformanceService(prisma);
  });

  // ── Helpers ──────────────────────────────────────────────

  /** Mock padrão: 10 orçamentos criados, 4 aprovados, receita 5000, 3 follow-ups. */
  function mockDefaults() {
    prisma.quote.count
      .mockResolvedValueOnce(10) // quotesCreated
      .mockResolvedValueOnce(4); // quotesApproved
    prisma.serviceOrder.aggregate.mockResolvedValue({
      _sum: { saleValue: new Decimal('5000.00') },
    });
    prisma.quoteFollowUp.count.mockResolvedValue(3);
    prisma.quoteFollowUp.groupBy.mockResolvedValue([
      { createdById: USER_A, _count: { _all: 2 } },
      { createdById: USER_B, _count: { _all: 1 } },
    ]);
    prisma.companyMember.findMany.mockResolvedValue([
      {
        id: 'member-a',
        companyId: COMPANY_ID,
        userId: USER_A,
        role: 'SALES',
        status: 'ATIVO',
        user: { id: USER_A, name: 'Vendedor A' },
      },
      {
        id: 'member-b',
        companyId: COMPANY_ID,
        userId: USER_B,
        role: 'SALES',
        status: 'ATIVO',
        user: { id: USER_B, name: 'Vendedor B' },
      },
    ]);
    prisma.quote.aggregate.mockResolvedValue({
      _sum: { total: new Decimal('12000.00') },
    });
  }

  function mockGoal(overrides: Record<string, any> = {}) {
    return {
      id: 'goal-1',
      companyId: COMPANY_ID,
      year: 2026,
      month: 8,
      targetQuoteAmount: new Decimal('10000.00'),
      targetRevenue: new Decimal('10000.00'),
      targetApprovedQuotes: 10,
      ...overrides,
    };
  }

  // ── Totais ───────────────────────────────────────────────

  describe('totais do período', () => {
    it('agrega orçamentos, receita, follow-ups e approvalRate', async () => {
      mockDefaults();
      prisma.companyGoal.findFirst.mockResolvedValue(mockGoal());

      const result = await service.getPerformance(COMPANY_ID, 2026, 8);

      expect(result.period).toEqual({ year: 2026, month: 8 });
      expect(result.totals).toEqual({
        quotesCreated: 10,
        quotesApproved: 4,
        approvalRate: 40, // 4/10 * 100
        revenue: 5000,
        followUpsDone: 3,
      });
    });

    it('approvalRate é null quando nenhum orçamento foi criado no mês', async () => {
      mockDefaults();
      prisma.quote.count.mockReset();
      prisma.quote.count
        .mockResolvedValueOnce(0) // quotesCreated
        .mockResolvedValueOnce(0); // quotesApproved
      prisma.companyGoal.findFirst.mockResolvedValue(null);

      const result = await service.getPerformance(COMPANY_ID, 2026, 8);

      expect(result.totals.approvalRate).toBeNull();
    });

    it('revenue é 0 quando não há OS no período', async () => {
      mockDefaults();
      prisma.serviceOrder.aggregate.mockResolvedValue({ _sum: { saleValue: null } });
      prisma.companyGoal.findFirst.mockResolvedValue(null);

      const result = await service.getPerformance(COMPANY_ID, 2026, 8);

      expect(result.totals.revenue).toBe(0);
    });

    it('todas as queries são tenant-scoped (companyId no where)', async () => {
      mockDefaults();
      prisma.companyGoal.findFirst.mockResolvedValue(null);

      await service.getPerformance(OTHER_COMPANY_ID, 2026, 8);

      const whereOf = (mock: any) => mock.mock.calls[0][0].where;
      expect(whereOf(prisma.quote.count).companyId).toBe(OTHER_COMPANY_ID);
      expect(whereOf(prisma.serviceOrder.aggregate).companyId).toBe(
        OTHER_COMPANY_ID,
      );
      expect(whereOf(prisma.quoteFollowUp.count).companyId).toBe(
        OTHER_COMPANY_ID,
      );
      expect(whereOf(prisma.quoteFollowUp.groupBy).companyId).toBe(
        OTHER_COMPANY_ID,
      );
      expect(whereOf(prisma.companyGoal.findFirst).companyId).toBe(
        OTHER_COMPANY_ID,
      );
      expect(whereOf(prisma.companyMember.findMany).companyId).toBe(
        OTHER_COMPANY_ID,
      );
      expect(whereOf(prisma.quote.aggregate).companyId).toBe(OTHER_COMPANY_ID);
    });

    it('OS canceladas não contam na receita (status not CANCELADA)', async () => {
      mockDefaults();
      prisma.companyGoal.findFirst.mockResolvedValue(null);

      await service.getPerformance(COMPANY_ID, 2026, 8);

      const where = prisma.serviceOrder.aggregate.mock.calls[0][0].where;
      expect(where.status).toEqual({ not: 'CANCELADA' });
      expect(where.deletedAt).toBeNull();
    });
  });

  // ── Metas (% vs meta) ────────────────────────────────────

  describe('metas', () => {
    it('calcula pct vs meta quando existe meta do período', async () => {
      mockDefaults();
      prisma.companyGoal.findFirst.mockResolvedValue(mockGoal());

      const result = await service.getPerformance(COMPANY_ID, 2026, 8);

      expect(result.goals).toEqual({
        targetQuoteAmount: 10000,
        targetRevenue: 10000,
        targetApprovedQuotes: 10,
        quoteAmountPct: 120, // 12000/10000
        revenuePct: 50, // 5000/10000
        approvedQuotesPct: 40, // 4/10
      });
    });

    it('retorna nulls quando não existe meta do período', async () => {
      mockDefaults();
      prisma.companyGoal.findFirst.mockResolvedValue(null);

      const result = await service.getPerformance(COMPANY_ID, 2026, 8);

      expect(result.goals).toEqual({
        targetQuoteAmount: null,
        targetRevenue: null,
        targetApprovedQuotes: null,
        quoteAmountPct: null,
        revenuePct: null,
        approvedQuotesPct: null,
      });
    });

    it('pct é null quando a meta é zero (evita divisão por zero)', async () => {
      mockDefaults();
      prisma.companyGoal.findFirst.mockResolvedValue(
        mockGoal({
          targetQuoteAmount: new Decimal('0'),
          targetRevenue: new Decimal('0'),
          targetApprovedQuotes: 0,
        }),
      );

      const result = await service.getPerformance(COMPANY_ID, 2026, 8);

      expect(result.goals.quoteAmountPct).toBeNull();
      expect(result.goals.revenuePct).toBeNull();
      expect(result.goals.approvedQuotesPct).toBeNull();
    });

    it('busca a meta por companyId + year + month', async () => {
      mockDefaults();
      prisma.companyGoal.findFirst.mockResolvedValue(null);

      await service.getPerformance(COMPANY_ID, 2026, 8);

      expect(prisma.companyGoal.findFirst).toHaveBeenCalledWith({
        where: { companyId: COMPANY_ID, year: 2026, month: 8 },
      });
    });
  });

  // ── byMember (divisão por vendedor) ──────────────────────

  describe('byMember', () => {
    it('divide follow-ups concluídos por vendedor (QuoteFollowUp.createdById)', async () => {
      mockDefaults();
      prisma.companyGoal.findFirst.mockResolvedValue(null);

      const result = await service.getPerformance(COMPANY_ID, 2026, 8);

      expect(result.byMember).toEqual([
        {
          memberId: 'member-a',
          memberName: 'Vendedor A',
          role: 'SALES',
          quotesCreated: 0,
          quotesApproved: 0,
          approvalRate: null,
          revenue: 0,
          followUpsDone: 2,
        },
        {
          memberId: 'member-b',
          memberName: 'Vendedor B',
          role: 'SALES',
          quotesCreated: 0,
          quotesApproved: 0,
          approvalRate: null,
          revenue: 0,
          followUpsDone: 1,
        },
      ]);
    });

    it('membro sem follow-ups no período aparece com followUpsDone 0', async () => {
      mockDefaults();
      prisma.quoteFollowUp.groupBy.mockResolvedValue([
        { createdById: USER_A, _count: { _all: 5 } },
      ]);
      prisma.companyGoal.findFirst.mockResolvedValue(null);

      const result = await service.getPerformance(COMPANY_ID, 2026, 8);

      expect(result.byMember[0].followUpsDone).toBe(5);
      expect(result.byMember[1].followUpsDone).toBe(0);
    });

    it('follow-ups com createdById null não atribuem a nenhum membro', async () => {
      mockDefaults();
      prisma.quoteFollowUp.groupBy.mockResolvedValue([
        { createdById: null, _count: { _all: 4 } },
      ]);
      prisma.companyGoal.findFirst.mockResolvedValue(null);

      const result = await service.getPerformance(COMPANY_ID, 2026, 8);

      expect(result.byMember.every((m) => m.followUpsDone === 0)).toBe(true);
    });

    it('byMember é vazio quando a empresa não tem membros ativos', async () => {
      mockDefaults();
      prisma.companyMember.findMany.mockResolvedValue([]);
      prisma.companyGoal.findFirst.mockResolvedValue(null);

      const result = await service.getPerformance(COMPANY_ID, 2026, 8);

      expect(result.byMember).toEqual([]);
    });
  });
});
