import { GoalsService } from '../src/modules/goals/goals.service';

/**
 * Testes unitários do GoalsService — Metas mensais por empresa (CompanyGoal).
 *
 * PrismaService é mockado — nenhum banco é acessado.
 *
 * Cobre: getGoal (null quando não existe), setGoal (upsert na unique
 * companyId_year_month), listGoals, e tenant isolation (companyId sempre no where).
 */
describe('GoalsService', () => {
  let service: GoalsService;
  let prisma: any;

  const COMPANY_ID = 'company-1';
  const OTHER_COMPANY_ID = 'company-2';
  const USER_ID = 'user-1';

  beforeEach(() => {
    prisma = {
      companyGoal: {
        findFirst: jest.fn(),
        upsert: jest.fn(),
        findMany: jest.fn(),
      },
    };
    service = new GoalsService(prisma);
  });

  // ── Helpers ──────────────────────────────────────────────

  function mockGoal(overrides: Record<string, any> = {}) {
    return {
      id: 'goal-1',
      companyId: COMPANY_ID,
      year: 2026,
      month: 8,
      targetQuoteAmount: '10000.00',
      targetRevenue: '8000.00',
      targetApprovedQuotes: 20,
      createdById: USER_ID,
      createdAt: new Date('2026-08-01T00:00:00Z'),
      updatedAt: new Date('2026-08-01T00:00:00Z'),
      company: { id: COMPANY_ID, tradeName: 'SmartGesso' },
      createdBy: { id: USER_ID, name: 'Test User' },
      ...overrides,
    };
  }

  // ── getGoal ──────────────────────────────────────────────

  describe('getGoal', () => {
    it('busca a meta por companyId + year + month (tenant-scoped)', async () => {
      prisma.companyGoal.findFirst.mockResolvedValue(mockGoal());

      const result = await service.getGoal(COMPANY_ID, 2026, 8);

      expect(prisma.companyGoal.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            companyId: COMPANY_ID,
            year: 2026,
            month: 8,
          },
        }),
      );
      expect(result).not.toBeNull();
      expect(result!.id).toBe('goal-1');
    });

    it('retorna null quando não existe meta para o período', async () => {
      prisma.companyGoal.findFirst.mockResolvedValue(null);

      const result = await service.getGoal(COMPANY_ID, 2026, 9);

      expect(result).toBeNull();
    });

    it('tenant isolation: não retorna meta de outra empresa', async () => {
      // A query é sempre filtrada por companyId — o mock recebe o companyId correto.
      prisma.companyGoal.findFirst.mockResolvedValue(null);

      await service.getGoal(OTHER_COMPANY_ID, 2026, 8);

      expect(prisma.companyGoal.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: OTHER_COMPANY_ID,
          }),
        }),
      );
    });
  });

  // ── setGoal (upsert) ─────────────────────────────────────

  describe('setGoal', () => {
    it('faz upsert na unique companyId_year_month', async () => {
      prisma.companyGoal.upsert.mockResolvedValue(mockGoal());

      await service.setGoal(COMPANY_ID, USER_ID, {
        year: 2026,
        month: 8,
        targetQuoteAmount: 10000,
        targetRevenue: 8000,
        targetApprovedQuotes: 20,
      });

      expect(prisma.companyGoal.upsert).toHaveBeenCalledTimes(1);
      const call = prisma.companyGoal.upsert.mock.calls[0][0];
      expect(call.where).toEqual({
        companyId_year_month: { companyId: COMPANY_ID, year: 2026, month: 8 },
      });
      // create grava createdById; update não reescreve.
      expect(call.create.createdById).toBe(USER_ID);
      expect(call.update.createdById).toBeUndefined();
      expect(call.create.targetQuoteAmount).toBe(10000);
      expect(call.update.targetRevenue).toBe(8000);
    });

    it('gravado por usuário anônimo: createdById fica null na criação', async () => {
      prisma.companyGoal.upsert.mockResolvedValue(mockGoal());

      await service.setGoal(COMPANY_ID, undefined, {
        year: 2026,
        month: 8,
        targetQuoteAmount: 100,
        targetRevenue: 50,
        targetApprovedQuotes: 1,
      });

      const call = prisma.companyGoal.upsert.mock.calls[0][0];
      expect(call.create.createdById).toBeNull();
    });

    it('tenant isolation: upsert usa o companyId do tenant ativo', async () => {
      prisma.companyGoal.upsert.mockResolvedValue(mockGoal());

      await service.setGoal(OTHER_COMPANY_ID, USER_ID, {
        year: 2026,
        month: 8,
        targetQuoteAmount: 1,
        targetRevenue: 1,
        targetApprovedQuotes: 1,
      });

      const call = prisma.companyGoal.upsert.mock.calls[0][0];
      expect(call.where.companyId_year_month.companyId).toBe(OTHER_COMPANY_ID);
      expect(call.create.companyId).toBe(OTHER_COMPANY_ID);
    });
  });

  // ── listGoals ────────────────────────────────────────────

  describe('listGoals', () => {
    it('lista todas as metas da empresa (tenant-scoped), do mais recente', async () => {
      prisma.companyGoal.findMany.mockResolvedValue([mockGoal()]);

      const result = await service.listGoals(COMPANY_ID);

      expect(prisma.companyGoal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: COMPANY_ID },
          orderBy: [{ year: 'desc' }, { month: 'desc' }],
        }),
      );
      expect(result).toHaveLength(1);
    });

    it('tenant isolation: lista apenas metas da empresa ativa', async () => {
      prisma.companyGoal.findMany.mockResolvedValue([]);

      await service.listGoals(OTHER_COMPANY_ID);

      expect(prisma.companyGoal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: OTHER_COMPANY_ID },
        }),
      );
    });
  });
});
