import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ServiceAdditionalsService } from '../src/modules/service-additionals/service-additionals.service';
import {
  SEQUENCE_TYPES,
} from '../src/modules/core/services/company-sequence.service';
import { ServiceAdditionalStatus } from '@prisma/client';

/**
 * Testes unitários do ServiceAdditionalsService — ETAPA 9.
 *
 * PrismaService e CompanySequenceService são mockados — nenhum banco é acessado.
 *
 * Cobre: CRUD, transições inválidas, tenant isolation e numeração.
 */
describe('ServiceAdditionalsService', () => {
  let service: ServiceAdditionalsService;
  let prisma: any;
  let sequenceService: any;

  const COMPANY_ID = 'company-1';
  const OTHER_COMPANY_ID = 'company-2';
  const SERVICE_ORDER_ID = 'so-1';
  const ADDITIONAL_ID = 'add-1';

  beforeEach(() => {
    prisma = {
      serviceOrder: { findFirst: jest.fn() },
      serviceAdditional: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        aggregate: jest.fn(),
      },
    };
    sequenceService = {
      increment: jest.fn(),
    };
    service = new ServiceAdditionalsService(
      prisma,
      sequenceService,
      { create: jest.fn().mockResolvedValue({}) } as any,
      { sendToCompany: jest.fn().mockResolvedValue({ sent: 0 }), create: jest.fn().mockResolvedValue({}) } as any,
    );
  });

  // ── Helpers ──────────────────────────────────────────────

  function mockServiceOrderExists() {
    prisma.serviceOrder.findFirst.mockResolvedValue({ id: SERVICE_ORDER_ID });
  }

  function mockServiceOrderNotFound() {
    prisma.serviceOrder.findFirst.mockResolvedValue(null);
  }

  function mockAdditional(overrides: Record<string, any> = {}) {
    return {
      id: ADDITIONAL_ID,
      companyId: COMPANY_ID,
      serviceOrderId: SERVICE_ORDER_ID,
      code: 1,
      description: 'Aditivo de teste',
      amount: 500,
      estimatedCost: 300,
      status: 'DRAFT' as ServiceAdditionalStatus,
      approvedAt: null,
      rejectedAt: null,
      notes: null,
      createdById: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      serviceOrder: { id: SERVICE_ORDER_ID, code: 10 },
      createdBy: { id: 'user-1', name: 'Test User' },
      ...overrides,
    };
  }

  // ── list ───────────────────────────────────────────────

  describe('list', () => {
    it('retorna aditivos da OS quando a OS pertence à empresa', async () => {
      mockServiceOrderExists();
      const additionals = [mockAdditional(), mockAdditional({ id: 'add-2' })];
      prisma.serviceAdditional.findMany.mockResolvedValue(additionals);

      const result = await service.list(COMPANY_ID, SERVICE_ORDER_ID);

      expect(prisma.serviceAdditional.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: COMPANY_ID,
            serviceOrderId: SERVICE_ORDER_ID,
            deletedAt: null,
          }),
        }),
      );
      expect(result).toHaveLength(2);
      expect(result[0].amount).toBe(500);
    });

    it('lança BadRequestException quando a OS não pertence à empresa (tenant isolation)', async () => {
      mockServiceOrderNotFound();

      await expect(service.list(COMPANY_ID, SERVICE_ORDER_ID)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ── create ─────────────────────────────────────────────

  describe('create', () => {
    it('cria aditivo com código da sequência e converte Decimal para number', async () => {
      mockServiceOrderExists();
      sequenceService.increment.mockResolvedValue(42);
      const created = mockAdditional({ code: 42 });
      prisma.serviceAdditional.create.mockResolvedValue(created);

      const result = await service.create(COMPANY_ID, SERVICE_ORDER_ID, {
        description: 'Aditivo de teste',
        amount: 500,
        estimatedCost: 300,
      });

      // Verifica que a sequência foi chamada com o tipo correto
      expect(sequenceService.increment).toHaveBeenCalledWith(
        COMPANY_ID,
        SEQUENCE_TYPES.SERVICE_ADDITIONAL,
      );

      // Verifica que o create recebeu o código da sequência
      expect(prisma.serviceAdditional.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: COMPANY_ID,
            serviceOrderId: SERVICE_ORDER_ID,
            code: 42,
            description: 'Aditivo de teste',
            amount: 500,
            estimatedCost: 300,
          }),
        }),
      );

      // Decimal convertido para number
      expect(result.code).toBe(42);
      expect(result.amount).toBe(500);
      expect(result.estimatedCost).toBe(300);
    });

    it('lança BadRequestException quando a OS não pertence à empresa', async () => {
      mockServiceOrderNotFound();

      await expect(
        service.create(COMPANY_ID, SERVICE_ORDER_ID, {
          description: 'x',
          amount: 100,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('define createdById quando userId é informado', async () => {
      mockServiceOrderExists();
      sequenceService.increment.mockResolvedValue(1);
      prisma.serviceAdditional.create.mockResolvedValue(
        mockAdditional({ createdById: 'user-99' }),
      );

      await service.create(
        COMPANY_ID,
        SERVICE_ORDER_ID,
        { description: 'x', amount: 100 },
        'user-99',
      );

      expect(prisma.serviceAdditional.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ createdById: 'user-99' }),
        }),
      );
    });
  });

  // ── update ─────────────────────────────────────────────

  describe('update', () => {
    it('atualiza aditivo em DRAFT', async () => {
      prisma.serviceAdditional.findFirst.mockResolvedValue(
        mockAdditional({ status: 'DRAFT' }),
      );
      prisma.serviceAdditional.update.mockResolvedValue(
        mockAdditional({ description: 'Atualizado', amount: 750 }),
      );

      const result = await service.update(COMPANY_ID, SERVICE_ORDER_ID, ADDITIONAL_ID, {
        description: 'Atualizado',
        amount: 750,
      });

      expect(result.description).toBe('Atualizado');
      expect(result.amount).toBe(750);
    });

    it('lança BadRequestException quando o aditivo não está em DRAFT', async () => {
      prisma.serviceAdditional.findFirst.mockResolvedValue(
        mockAdditional({ status: 'SENT' }),
      );

      await expect(
        service.update(COMPANY_ID, SERVICE_ORDER_ID, ADDITIONAL_ID, {
          description: 'x',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lança NotFoundException quando o aditivo não existe', async () => {
      prisma.serviceAdditional.findFirst.mockResolvedValue(null);

      await expect(
        service.update(COMPANY_ID, SERVICE_ORDER_ID, 'inexistente', {
          description: 'x',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('lança NotFoundException quando o aditivo não pertence à empresa (tenant isolation via findOne)', async () => {
      prisma.serviceAdditional.findFirst.mockResolvedValue(null);

      await expect(
        service.update(COMPANY_ID, SERVICE_ORDER_ID, ADDITIONAL_ID, {
          description: 'x',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── updateStatus ───────────────────────────────────────

  describe('updateStatus', () => {
    it('DRAFT → SENT: transição válida', async () => {
      prisma.serviceAdditional.findFirst.mockResolvedValue(
        mockAdditional({ status: 'DRAFT' }),
      );
      prisma.serviceAdditional.update.mockResolvedValue(
        mockAdditional({ status: 'SENT' }),
      );

      const result = await service.updateStatus(
        COMPANY_ID,
        SERVICE_ORDER_ID,
        ADDITIONAL_ID,
        'SENT',
      );

      expect(result.status).toBe('SENT');
    });

    it('SENT → APPROVED: transição válida e registra approvedAt', async () => {
      prisma.serviceAdditional.findFirst.mockResolvedValue(
        mockAdditional({ status: 'SENT' }),
      );
      prisma.serviceAdditional.update.mockResolvedValue(
        mockAdditional({ status: 'APPROVED', approvedAt: new Date() }),
      );

      const result = await service.updateStatus(
        COMPANY_ID,
        SERVICE_ORDER_ID,
        ADDITIONAL_ID,
        'APPROVED',
      );

      expect(result.status).toBe('APPROVED');
      expect(prisma.serviceAdditional.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'APPROVED',
            approvedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('SENT → REJECTED: transição válida e registra rejectedAt', async () => {
      prisma.serviceAdditional.findFirst.mockResolvedValue(
        mockAdditional({ status: 'SENT' }),
      );
      prisma.serviceAdditional.update.mockResolvedValue(
        mockAdditional({ status: 'REJECTED', rejectedAt: new Date() }),
      );

      const result = await service.updateStatus(
        COMPANY_ID,
        SERVICE_ORDER_ID,
        ADDITIONAL_ID,
        'REJECTED',
      );

      expect(result.status).toBe('REJECTED');
      expect(prisma.serviceAdditional.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'REJECTED',
            rejectedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('APPROVED → CANCELLED: transição válida', async () => {
      prisma.serviceAdditional.findFirst.mockResolvedValue(
        mockAdditional({ status: 'APPROVED' }),
      );
      prisma.serviceAdditional.update.mockResolvedValue(
        mockAdditional({ status: 'CANCELLED' }),
      );

      const result = await service.updateStatus(
        COMPANY_ID,
        SERVICE_ORDER_ID,
        ADDITIONAL_ID,
        'CANCELLED',
      );

      expect(result.status).toBe('CANCELLED');
    });

    it('DRAFT → APPROVED: transição INVÁLIDA (deve passar por SENT)', async () => {
      prisma.serviceAdditional.findFirst.mockResolvedValue(
        mockAdditional({ status: 'DRAFT' }),
      );

      await expect(
        service.updateStatus(
          COMPANY_ID,
          SERVICE_ORDER_ID,
          ADDITIONAL_ID,
          'APPROVED',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('APPROVED → SENT: transição INVÁLIDA (estado termina em CANCELLED)', async () => {
      prisma.serviceAdditional.findFirst.mockResolvedValue(
        mockAdditional({ status: 'APPROVED' }),
      );

      await expect(
        service.updateStatus(
          COMPANY_ID,
          SERVICE_ORDER_ID,
          ADDITIONAL_ID,
          'SENT',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('REJECTED → APPROVED: transição INVÁLIDA (estado terminal)', async () => {
      prisma.serviceAdditional.findFirst.mockResolvedValue(
        mockAdditional({ status: 'REJECTED' }),
      );

      await expect(
        service.updateStatus(
          COMPANY_ID,
          SERVICE_ORDER_ID,
          ADDITIONAL_ID,
          'APPROVED',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('CANCELLED → APPROVED: transição INVÁLIDA (estado terminal)', async () => {
      prisma.serviceAdditional.findFirst.mockResolvedValue(
        mockAdditional({ status: 'CANCELLED' }),
      );

      await expect(
        service.updateStatus(
          COMPANY_ID,
          SERVICE_ORDER_ID,
          ADDITIONAL_ID,
          'APPROVED',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('lança NotFoundException quando o aditivo não existe', async () => {
      prisma.serviceAdditional.findFirst.mockResolvedValue(null);

      await expect(
        service.updateStatus(
          COMPANY_ID,
          SERVICE_ORDER_ID,
          'inexistente',
          'SENT',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── tenant isolation ───────────────────────────────────

  describe('tenant isolation', () => {
    it('findOne filtra por companyId — aditivo de outra empresa não é encontrado', async () => {
      mockServiceOrderExists();
      prisma.serviceAdditional.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne(OTHER_COMPANY_ID, SERVICE_ORDER_ID, ADDITIONAL_ID),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.serviceAdditional.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: ADDITIONAL_ID,
            companyId: OTHER_COMPANY_ID,
            serviceOrderId: SERVICE_ORDER_ID,
          }),
        }),
      );
    });

    it('create não cria aditivo para OS de outra empresa', async () => {
      mockServiceOrderNotFound();

      await expect(
        service.create(OTHER_COMPANY_ID, SERVICE_ORDER_ID, {
          description: 'x',
          amount: 100,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── numeração ──────────────────────────────────────────

  describe('numeração', () => {
    it('usa SEQUENCE_TYPES.SERVICE_ADDITIONAL para gerar o código', async () => {
      mockServiceOrderExists();
      sequenceService.increment.mockResolvedValue(7);
      prisma.serviceAdditional.create.mockResolvedValue(
        mockAdditional({ code: 7 }),
      );

      await service.create(COMPANY_ID, SERVICE_ORDER_ID, {
        description: 'x',
        amount: 100,
      });

      expect(sequenceService.increment).toHaveBeenCalledWith(
        COMPANY_ID,
        SEQUENCE_TYPES.SERVICE_ADDITIONAL,
      );
    });

    it('código é único por tenant — company A e B não compartilham sequência', async () => {
      mockServiceOrderExists();
      sequenceService.increment.mockResolvedValueOnce(1);
      sequenceService.increment.mockResolvedValueOnce(1);
      prisma.serviceAdditional.create.mockResolvedValue(mockAdditional());

      await service.create(COMPANY_ID, SERVICE_ORDER_ID, {
        description: 'x',
        amount: 100,
      });
      await service.create(OTHER_COMPANY_ID, SERVICE_ORDER_ID, {
        description: 'y',
        amount: 200,
      });

      expect(sequenceService.increment).toHaveBeenNthCalledWith(
        1,
        COMPANY_ID,
        SEQUENCE_TYPES.SERVICE_ADDITIONAL,
      );
      expect(sequenceService.increment).toHaveBeenNthCalledWith(
        2,
        OTHER_COMPANY_ID,
        SEQUENCE_TYPES.SERVICE_ADDITIONAL,
      );
    });
  });
});
