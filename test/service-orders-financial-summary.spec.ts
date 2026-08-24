import { NotFoundException } from '@nestjs/common';
import { ServiceOrdersService } from '../src/modules/service-orders/service-orders.service';

/**
 * Testes unitários do getFinancialSummary — ETAPA 7.
 * PrismaService é mockado — nenhum banco é acessado.
 *
 * Cobre: despesa direta, despesa geral, recebimento parcial, parcelas,
 * tenant (isolamento de empresa) e cálculo de margem.
 */
describe('ServiceOrdersService.getFinancialSummary', () => {
  let service: ServiceOrdersService;
  let prisma: any;

  const SERVICE_ORDER_ID = 'so-1';
  const COMPANY_ID = 'company-1';

  beforeEach(() => {
    prisma = {
      serviceOrder: { findFirst: jest.fn() },
      payment: { aggregate: jest.fn() },
      paymentInstallment: { aggregate: jest.fn() },
      expense: { aggregate: jest.fn() },
      serviceAdditional: { aggregate: jest.fn() },
    };
    service = new ServiceOrdersService(prisma, {} as any);
  });

  // ── Helpers ──────────────────────────────────────────────

  function mockServiceOrder(overrides: Record<string, any> = {}) {
    prisma.serviceOrder.findFirst.mockResolvedValue({
      id: SERVICE_ORDER_ID,
      companyId: COMPANY_ID,
      saleValue: 1000,
      cost: 400,
      quote: null,
      ...overrides,
    });
  }

  function mockDirectPayments(sum: number) {
    prisma.payment.aggregate.mockResolvedValue({ _sum: { amount: sum } });
  }

  function mockInstallmentPayments(sum: number) {
    prisma.paymentInstallment.aggregate.mockResolvedValue({
      _sum: { amount: sum },
    });
  }

  function mockExpenses(sum: number) {
    prisma.expense.aggregate.mockResolvedValue({ _sum: { amount: sum } });
  }

  function mockAdditionalApproved(sum: number) {
    prisma.serviceAdditional.aggregate.mockResolvedValue({
      _sum: { amount: sum },
    });
  }

  function mockAll(opts: {
    order?: Record<string, any>;
    directPayments?: number;
    installmentPayments?: number;
    expenses?: number;
    additionalApproved?: number;
  } = {}) {
    mockServiceOrder(opts.order);
    mockDirectPayments(opts.directPayments ?? 0);
    mockInstallmentPayments(opts.installmentPayments ?? 0);
    mockExpenses(opts.expenses ?? 0);
    mockAdditionalApproved(opts.additionalApproved ?? 0);
  }

  // ── Testes ───────────────────────────────────────────────

  it('retorna 404 quando a OS não existe', async () => {
    prisma.serviceOrder.findFirst.mockResolvedValue(null);
    await expect(
      service.getFinancialSummary(COMPANY_ID, 'inexistente'),
    ).rejects.toThrow(NotFoundException);
  });

  it('despesa direta: expense vinculado à OS é contabilizado em realizedCost', async () => {
    mockAll({ expenses: 150 });
    const result = await service.getFinancialSummary(COMPANY_ID, SERVICE_ORDER_ID);

    // realizedCost deve refletir a despesa direta
    expect(result.realizedCost).toBe(150);
    // cashResult = received(0) - realizedCost(150) = -150
    expect(result.cashResult).toBe(-150);
  });

  it('despesa geral: expense sem vínculo à OS NÃO é contabilizada', async () => {
    // A query do expense.aggregate filtra por serviceOrderId, então despesas
    // gerais (serviceOrderId = null) retornam _sum.amount = 0
    mockAll({ expenses: 0 });
    const result = await service.getFinancialSummary(COMPANY_ID, SERVICE_ORDER_ID);

    expect(result.realizedCost).toBe(0);
    expect(result.cashResult).toBe(0);
  });

  it('recebimento parcial: payment CONFIRMADO parcial é contabilizado em received', async () => {
    // Payment único (installmentCount = 1), status CONFIRMADO, amount = 300
    mockAll({ directPayments: 300 });
    const result = await service.getFinancialSummary(COMPANY_ID, SERVICE_ORDER_ID);

    expect(result.received).toBe(300);
    // toReceive = totalContracted(1000) - received(300) = 700
    expect(result.toReceive).toBe(700);
  });

  it('parcelas: soma apenas parcelas CONFIRMADO de payments com múltiplas parcelas', async () => {
    // Payment com 3 parcelas: 2 CONFIRMADO (333.33 + 333.33 = 666.66), 1 PENDENTE
    // O aggregate de paymentInstallment retorna apenas o sum das CONFIRMADO
    mockAll({ installmentPayments: 666.66 });
    const result = await service.getFinancialSummary(COMPANY_ID, SERVICE_ORDER_ID);

    expect(result.received).toBe(666.66);
    expect(result.toReceive).toBe(333.34);
  });

  it('parcelas: payment sem parcelas (installmentCount=1) CONFIRMADO conta amount integral', async () => {
    // Payment único CONFIRMADO
    mockAll({ directPayments: 1000 });
    const result = await service.getFinancialSummary(COMPANY_ID, SERVICE_ORDER_ID);

    expect(result.received).toBe(1000);
    expect(result.toReceive).toBe(0);
  });

  it('tenant: payments/expenses de outra empresa NÃO são contabilizados', async () => {
    // A query filtra por companyId, então dados de outra empresa retornam 0
    mockAll({
      order: { companyId: COMPANY_ID },
      directPayments: 0,
      installmentPayments: 0,
      expenses: 0,
    });
    const result = await service.getFinancialSummary(COMPANY_ID, SERVICE_ORDER_ID);

    expect(result.received).toBe(0);
    expect(result.realizedCost).toBe(0);
  });

  it('margem: margin = projectedResult / totalContracted * 100', async () => {
    // saleValue = 1000, cost = 600
    // totalContracted = 1000, forecastCost = 600
    // projectedResult = 1000 - 600 = 400
    // margin = 400 / 1000 * 100 = 40
    mockAll({ order: { saleValue: 1000, cost: 600 } });
    const result = await service.getFinancialSummary(COMPANY_ID, SERVICE_ORDER_ID);

    expect(result.margin).toBe(40);
    expect(result.projectedResult).toBe(400);
  });

  it('margem: null quando totalContracted é 0', async () => {
    mockAll({ order: { saleValue: null, cost: 0, quote: null } });
    const result = await service.getFinancialSummary(COMPANY_ID, SERVICE_ORDER_ID);

    expect(result.margin).toBeNull();
    expect(result.totalContracted).toBe(0);
  });

  it('contractedValue usa saleValue da OS, com fallback para quote.total', async () => {
    // Caso 1: saleValue definido
    mockAll({ order: { saleValue: 1000, cost: 400, quote: null } });
    let result = await service.getFinancialSummary(COMPANY_ID, SERVICE_ORDER_ID);
    expect(result.contractedValue).toBe(1000);

    // Caso 2: saleValue null, fallback para quote.total
    mockAll({
      order: { saleValue: null, cost: 400, quote: { total: 2500 } },
    });
    result = await service.getFinancialSummary(COMPANY_ID, SERVICE_ORDER_ID);
    expect(result.contractedValue).toBe(2500);

    // Caso 3: saleValue null e quote null → 0
    mockAll({ order: { saleValue: null, cost: 0, quote: null } });
    result = await service.getFinancialSummary(COMPANY_ID, SERVICE_ORDER_ID);
    expect(result.contractedValue).toBe(0);
  });

  it('additionalApproved soma apenas aditivos APPROVED (placeholder sem aditivos = 0)', async () => {
    mockAll();
    const result = await service.getFinancialSummary(COMPANY_ID, SERVICE_ORDER_ID);
    expect(result.additionalApproved).toBe(0);
  });

  it('additionalApproved reflete a soma de aditivos APPROVED', async () => {
    // OS: saleValue=1000, aditivos aprovados=250
    // totalContracted = 1000 + 250 = 1250
    mockAll({ order: { saleValue: 1000, cost: 400 }, additionalApproved: 250 });
    const result = await service.getFinancialSummary(COMPANY_ID, SERVICE_ORDER_ID);

    expect(result.additionalApproved).toBe(250);
    expect(result.totalContracted).toBe(1250);
  });

  it('verifica que a query de aditivos filtra por status APPROVED e companyId (tenant)', async () => {
    mockAll();

    await service.getFinancialSummary(COMPANY_ID, SERVICE_ORDER_ID);

    expect(prisma.serviceAdditional.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          serviceOrderId: SERVICE_ORDER_ID,
          companyId: COMPANY_ID,
          status: 'APPROVED',
          deletedAt: null,
        }),
      }),
    );
  });

  it('NÃO usa profit do schema como input confiável', async () => {
    // profit está no schema mas deve ser ignorado — resultado vem de payments/expenses
    mockAll({
      order: { saleValue: 1000, cost: 400, profit: 9999 },
      directPayments: 500,
      expenses: 200,
    });
    const result = await service.getFinancialSummary(COMPANY_ID, SERVICE_ORDER_ID);

    // projectedResult = totalContracted(1000) - forecastCost(400) = 600
    // NÃO usa profit(9999)
    expect(result.projectedResult).toBe(600);
    // cashResult = received(500) - realizedCost(200) = 300
    expect(result.cashResult).toBe(300);
  });

  it('cenário completo: despesa direta + recebimento parcial + parcelas', async () => {
    // OS: saleValue=2000, cost=800
    // Payment direto CONFIRMADO: 500
    // Payment parcelado: 2 de 3 parcelas CONFIRMADO = 300
    // Expense direto: 250
    mockAll({
      order: { saleValue: 2000, cost: 800 },
      directPayments: 500,
      installmentPayments: 300,
      expenses: 250,
    });
    const result = await service.getFinancialSummary(COMPANY_ID, SERVICE_ORDER_ID);

    expect(result.contractedValue).toBe(2000);
    expect(result.additionalApproved).toBe(0);
    expect(result.totalContracted).toBe(2000);
    expect(result.received).toBe(800); // 500 + 300
    expect(result.toReceive).toBe(1200); // 2000 - 800
    expect(result.forecastCost).toBe(800);
    expect(result.realizedCost).toBe(250);
    expect(result.projectedResult).toBe(1200); // 2000 - 800
    expect(result.cashResult).toBe(550); // 800 - 250
    expect(result.margin).toBe(60); // 1200 / 2000 * 100
  });

  it('verifica que as queries filtram por companyId (isolamento de tenant)', async () => {
    mockAll();

    await service.getFinancialSummary(COMPANY_ID, SERVICE_ORDER_ID);

    // serviceOrder.findFirst deve filtrar por companyId
    expect(prisma.serviceOrder.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: SERVICE_ORDER_ID,
          companyId: COMPANY_ID,
        }),
      }),
    );

    // payment.aggregate deve filtrar por companyId
    expect(prisma.payment.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          serviceOrderId: SERVICE_ORDER_ID,
          companyId: COMPANY_ID,
        }),
      }),
    );

    // expense.aggregate deve filtrar por companyId
    expect(prisma.expense.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          serviceOrderId: SERVICE_ORDER_ID,
          companyId: COMPANY_ID,
        }),
      }),
    );
  });
});
