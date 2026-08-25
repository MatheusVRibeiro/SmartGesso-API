import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ServiceReceivablesService } from '../src/modules/service-receivables/service-receivables.service';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * Testes unitários do ServiceReceivablesService — ETAPA 7 complementar.
 *
 * PrismaService é mockado — nenhum banco é acessado.
 *
 * Cobre: geração de recebíveis, pagamento parcial, tenant isolation.
 */
describe('ServiceReceivablesService', () => {
  let service: ServiceReceivablesService;
  let prisma: any;

  const COMPANY_ID = 'company-1';
  const OTHER_COMPANY_ID = 'company-2';
  const SERVICE_ORDER_ID = 'so-1';
  const RECEIVABLE_ID = 'recv-1';
  const INSTALLMENT_ID = 'inst-1';

  beforeEach(() => {
    prisma = {
      serviceOrder: {
        findFirst: jest.fn(),
      },
      serviceReceivable: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      receivableInstallment: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };
    service = new ServiceReceivablesService(
      prisma,
      { create: jest.fn().mockResolvedValue({}) } as any,
      { sendToCompany: jest.fn().mockResolvedValue({ sent: 0 }), create: jest.fn().mockResolvedValue({}) } as any,
    );
  });

  // ── Helpers ──────────────────────────────────────────────

  function mockServiceOrder(overrides: Record<string, any> = {}) {
    return {
      id: SERVICE_ORDER_ID,
      companyId: COMPANY_ID,
      saleValue: new Decimal(1000.00),
      status: 'CONCLUIDA',
      ...overrides,
    };
  }

  function mockReceivable(overrides: Record<string, any> = {}) {
    return {
      id: RECEIVABLE_ID,
      companyId: COMPANY_ID,
      serviceOrderId: SERVICE_ORDER_ID,
      total: new Decimal(1000.00),
      status: 'PENDING',
      createdAt: new Date(),
      updatedAt: new Date(),
      installments: [],
      ...overrides,
    };
  }

  function mockInstallment(overrides: Record<string, any> = {}) {
    return {
      id: INSTALLMENT_ID,
      receivableId: RECEIVABLE_ID,
      installmentNumber: 1,
      amount: new Decimal(500.00),
      dueDate: new Date(),
      status: 'PENDING',
      paidAt: null,
      paymentId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  // ── generateReceivables ──────────────────────────────────

  describe('generateReceivables', () => {
    it('gera recebíveis a partir do total da OS', async () => {
      prisma.serviceOrder.findFirst.mockResolvedValue(mockServiceOrder());
      prisma.serviceReceivable.findFirst.mockResolvedValue(null);
      prisma.serviceReceivable.create.mockResolvedValue(mockReceivable());

      const result = await service.generateReceivables(
        SERVICE_ORDER_ID,
        COMPANY_ID,
        { installments: 2, firstDueDate: '2026-09-01' },
      );

      expect(prisma.serviceReceivable.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: COMPANY_ID,
            serviceOrderId: SERVICE_ORDER_ID,
            total: expect.any(Decimal),
          }),
        }),
      );
      expect(result).toBeDefined();
    });

    it('lança NotFoundException quando OS não existe', async () => {
      prisma.serviceOrder.findFirst.mockResolvedValue(null);

      await expect(
        service.generateReceivables(SERVICE_ORDER_ID, COMPANY_ID, {
          installments: 2,
          firstDueDate: '2026-09-01',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('lança BadRequestException quando OS já possui recebíveis', async () => {
      prisma.serviceOrder.findFirst.mockResolvedValue(mockServiceOrder());
      prisma.serviceReceivable.findFirst.mockResolvedValue(mockReceivable());

      await expect(
        service.generateReceivables(SERVICE_ORDER_ID, COMPANY_ID, {
          installments: 2,
          firstDueDate: '2026-09-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lança BadRequestException quando saleValue é zero ou nulo', async () => {
      prisma.serviceOrder.findFirst.mockResolvedValue(
        mockServiceOrder({ saleValue: new Decimal(0) }),
      );

      await expect(
        service.generateReceivables(SERVICE_ORDER_ID, COMPANY_ID, {
          installments: 2,
          firstDueDate: '2026-09-01',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('tenant isolation: não gera recebíveis para OS de outra empresa', async () => {
      prisma.serviceOrder.findFirst.mockResolvedValue(null);

      await expect(
        service.generateReceivables(SERVICE_ORDER_ID, OTHER_COMPANY_ID, {
          installments: 2,
          firstDueDate: '2026-09-01',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.serviceOrder.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: SERVICE_ORDER_ID,
            companyId: OTHER_COMPANY_ID,
          }),
        }),
      );
    });
  });

  // ── getReceivablesByServiceOrder ─────────────────────────

  describe('getReceivablesByServiceOrder', () => {
    it('retorna recebíveis da OS', async () => {
      const receivables = [mockReceivable()];
      prisma.serviceReceivable.findMany.mockResolvedValue(receivables);

      const result = await service.getReceivablesByServiceOrder(
        SERVICE_ORDER_ID,
        COMPANY_ID,
      );

      expect(prisma.serviceReceivable.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            serviceOrderId: SERVICE_ORDER_ID,
            companyId: COMPANY_ID,
          }),
        }),
      );
      expect(result).toHaveLength(1);
    });

    it('tenant isolation: não retorna recebíveis de outra empresa', async () => {
      prisma.serviceReceivable.findMany.mockResolvedValue([]);

      await service.getReceivablesByServiceOrder(
        SERVICE_ORDER_ID,
        OTHER_COMPANY_ID,
      );

      expect(prisma.serviceReceivable.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: OTHER_COMPANY_ID,
          }),
        }),
      );
    });
  });

  // ── updateInstallment ────────────────────────────────────

  describe('updateInstallment', () => {
    it('marca parcela como paga', async () => {
      prisma.serviceReceivable.findFirst.mockResolvedValue(mockReceivable());
      prisma.receivableInstallment.findFirst.mockResolvedValue(mockInstallment());
      prisma.receivableInstallment.update.mockResolvedValue(
        mockInstallment({ status: 'PAID', paidAt: new Date() }),
      );
      prisma.receivableInstallment.findMany.mockResolvedValue([
        mockInstallment({ status: 'PAID', amount: new Decimal(500) }),
        mockInstallment({
          id: 'inst-2',
          status: 'PENDING',
          amount: new Decimal(500),
        }),
      ]);

      const result = await service.updateInstallment(
        RECEIVABLE_ID,
        INSTALLMENT_ID,
        COMPANY_ID,
        { paymentId: 'pay-1' },
      );

      expect(prisma.receivableInstallment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PAID',
            paymentId: 'pay-1',
          }),
        }),
      );
      expect(result.status).toBe('PAID');
    });

    it('atualiza status do recebível para PARTIAL quando pagamento parcial', async () => {
      prisma.serviceReceivable.findFirst.mockResolvedValue(mockReceivable());
      prisma.receivableInstallment.findFirst.mockResolvedValue(mockInstallment());
      prisma.receivableInstallment.update.mockResolvedValue(
        mockInstallment({ status: 'PAID', paidAt: new Date() }),
      );
      prisma.receivableInstallment.findMany.mockResolvedValue([
        mockInstallment({ status: 'PAID', amount: new Decimal(500) }),
        mockInstallment({
          id: 'inst-2',
          status: 'PENDING',
          amount: new Decimal(500),
        }),
      ]);

      await service.updateInstallment(
        RECEIVABLE_ID,
        INSTALLMENT_ID,
        COMPANY_ID,
        {},
      );

      expect(prisma.serviceReceivable.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: RECEIVABLE_ID },
          data: { status: 'PARTIAL' },
        }),
      );
    });

    it('atualiza status do recebível para RECEIVED quando todas parcelas pagas', async () => {
      prisma.serviceReceivable.findFirst.mockResolvedValue(mockReceivable());
      prisma.receivableInstallment.findFirst.mockResolvedValue(mockInstallment());
      prisma.receivableInstallment.update.mockResolvedValue(
        mockInstallment({ status: 'PAID', paidAt: new Date() }),
      );
      prisma.receivableInstallment.findMany.mockResolvedValue([
        mockInstallment({ status: 'PAID', amount: new Decimal(500) }),
        mockInstallment({
          id: 'inst-2',
          status: 'PAID',
          amount: new Decimal(500),
        }),
      ]);

      await service.updateInstallment(
        RECEIVABLE_ID,
        INSTALLMENT_ID,
        COMPANY_ID,
        {},
      );

      expect(prisma.serviceReceivable.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: RECEIVABLE_ID },
          data: { status: 'RECEIVED' },
        }),
      );
    });

    it('lança NotFoundException quando recebível não existe', async () => {
      prisma.serviceReceivable.findFirst.mockResolvedValue(null);

      await expect(
        service.updateInstallment(
          'inexistente',
          INSTALLMENT_ID,
          COMPANY_ID,
          {},
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('lança NotFoundException quando parcela não existe', async () => {
      prisma.serviceReceivable.findFirst.mockResolvedValue(mockReceivable());
      prisma.receivableInstallment.findFirst.mockResolvedValue(null);

      await expect(
        service.updateInstallment(
          RECEIVABLE_ID,
          'inexistente',
          COMPANY_ID,
          {},
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('tenant isolation: não atualiza parcela de recebível de outra empresa', async () => {
      prisma.serviceReceivable.findFirst.mockResolvedValue(null);

      await expect(
        service.updateInstallment(
          RECEIVABLE_ID,
          INSTALLMENT_ID,
          OTHER_COMPANY_ID,
          {},
        ),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.serviceReceivable.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: RECEIVABLE_ID,
            companyId: OTHER_COMPANY_ID,
          }),
        }),
      );
    });
  });
});
