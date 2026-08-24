import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PurchaseOrderStatus } from '@prisma/client';
import { PurchaseOrdersService } from '../src/modules/purchase-orders/purchase-orders.service';

/**
 * Testes unitários do PurchaseOrdersService — ETAPA 10.
 *
 * PrismaService e InventoryService são mockados — nenhum banco é acessado.
 *
 * Cobre: CRUD, transições de status, integração de estoque no RECEIVED
 * e tenant isolation.
 */
describe('PurchaseOrdersService', () => {
  let service: PurchaseOrdersService;
  let prisma: any;
  let inventory: any;

  const COMPANY_ID = 'company-1';
  const OTHER_COMPANY_ID = 'company-2';
  const PO_ID = 'po-1';
  const SUPPLIER_ID = 'sup-1';
  const SERVICE_ORDER_ID = 'so-1';
  const MATERIAL_ID = 'mat-1';

  beforeEach(() => {
    prisma = {
      supplier: { findFirst: jest.fn() },
      serviceOrder: { findFirst: jest.fn() },
      material: { findFirst: jest.fn() },
      purchaseOrder: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };
    inventory = {
      createMovement: jest.fn(),
    };
    service = new PurchaseOrdersService(prisma, inventory);
  });

  // ── Helpers ──────────────────────────────────────────────

  function mockSupplierExists() {
    prisma.supplier.findFirst.mockResolvedValue({ id: SUPPLIER_ID });
  }

  function mockSupplierNotFound() {
    prisma.supplier.findFirst.mockResolvedValue(null);
  }

  function mockServiceOrderExists() {
    prisma.serviceOrder.findFirst.mockResolvedValue({ id: SERVICE_ORDER_ID });
  }

  function mockServiceOrderNotFound() {
    prisma.serviceOrder.findFirst.mockResolvedValue(null);
  }

  function mockPO(overrides: Record<string, any> = {}) {
    return {
      id: PO_ID,
      companyId: COMPANY_ID,
      supplierId: SUPPLIER_ID,
      serviceOrderId: SERVICE_ORDER_ID,
      status: 'DRAFT' as PurchaseOrderStatus,
      total: 1000,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      supplier: { id: SUPPLIER_ID, name: 'Fornecedor Teste' },
      serviceOrder: { id: SERVICE_ORDER_ID, code: 10 },
      items: [
        {
          id: 'item-1',
          purchaseOrderId: PO_ID,
          catalogItemId: MATERIAL_ID,
          description: 'Material de teste',
          quantity: 10,
          unitPrice: 100,
          total: 1000,
          createdAt: new Date(),
        },
      ],
      ...overrides,
    };
  }

  // ── create ───────────────────────────────────────────────

  describe('create', () => {
    it('cria PO com items e calcula total automaticamente', async () => {
      mockSupplierExists();
      mockServiceOrderExists();
      prisma.purchaseOrder.create.mockResolvedValue(mockPO());

      const result = await service.create(COMPANY_ID, {
        supplierId: SUPPLIER_ID,
        serviceOrderId: SERVICE_ORDER_ID,
        notes: 'Observações',
        items: [
          {
            catalogItemId: MATERIAL_ID,
            description: 'Material de teste',
            quantity: 10,
            unitPrice: 100,
          },
        ],
      });

      // Total calculado: 10 * 100 = 1000
      expect(prisma.purchaseOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: COMPANY_ID,
            supplierId: SUPPLIER_ID,
            serviceOrderId: SERVICE_ORDER_ID,
            notes: 'Observações',
            total: expect.any(Object), // Prisma.Decimal
            items: {
              create: expect.arrayContaining([
                expect.objectContaining({
                  catalogItemId: MATERIAL_ID,
                  description: 'Material de teste',
                  quantity: 10,
                  unitPrice: 100,
                  total: 1000,
                }),
              ]),
            },
          }),
        }),
      );
      expect(result.total).toBe(1000);
    });

    it('calcula total como soma de múltiplos items', async () => {
      mockSupplierExists();
      prisma.purchaseOrder.create.mockResolvedValue(
        mockPO({
          total: 2000,
          items: [
            {
              id: 'item-1',
              purchaseOrderId: PO_ID,
              catalogItemId: MATERIAL_ID,
              description: 'Item 1',
              quantity: 10,
              unitPrice: 100,
              total: 1000,
              createdAt: new Date(),
            },
            {
              id: 'item-2',
              purchaseOrderId: PO_ID,
              catalogItemId: null,
              description: 'Item 2',
              quantity: 5,
              unitPrice: 200,
              total: 1000,
              createdAt: new Date(),
            },
          ],
        }),
      );

      const result = await service.create(COMPANY_ID, {
        items: [
          { description: 'Item 1', quantity: 10, unitPrice: 100 },
          { description: 'Item 2', quantity: 5, unitPrice: 200 },
        ],
      });

      expect(result.total).toBe(2000);
      expect(result.items).toHaveLength(2);
    });

    it('usa item.total quando informado em vez de calcular', async () => {
      mockSupplierExists();
      prisma.purchaseOrder.create.mockResolvedValue(mockPO());

      await service.create(COMPANY_ID, {
        supplierId: SUPPLIER_ID,
        items: [
          {
            description: 'Item com total informado',
            quantity: 10,
            unitPrice: 100,
            total: 500, // total informado diferente de quantity * unitPrice
          },
        ],
      });

      const call = prisma.purchaseOrder.create.mock.calls[0][0];
      expect(call.data.items.create[0].total).toBe(500);
    });

    it('lança BadRequestException quando supplier não pertence à empresa', async () => {
      mockSupplierNotFound();

      await expect(
        service.create(COMPANY_ID, {
          supplierId: SUPPLIER_ID,
          items: [{ description: 'x', quantity: 1, unitPrice: 10 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lança BadRequestException quando serviceOrder não pertence à empresa', async () => {
      mockSupplierExists();
      mockServiceOrderNotFound();

      await expect(
        service.create(COMPANY_ID, {
          supplierId: SUPPLIER_ID,
          serviceOrderId: SERVICE_ORDER_ID,
          items: [{ description: 'x', quantity: 1, unitPrice: 10 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── findAll ──────────────────────────────────────────────

  describe('findAll', () => {
    it('lista POs da empresa', async () => {
      prisma.purchaseOrder.findMany.mockResolvedValue([mockPO()]);

      const result = await service.findAll(COMPANY_ID);

      expect(prisma.purchaseOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: COMPANY_ID,
            deletedAt: null,
          }),
        }),
      );
      expect(result).toHaveLength(1);
    });

    it('filtra por serviceOrderId quando informado', async () => {
      prisma.purchaseOrder.findMany.mockResolvedValue([mockPO()]);

      await service.findAll(COMPANY_ID, SERVICE_ORDER_ID);

      expect(prisma.purchaseOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: COMPANY_ID,
            serviceOrderId: SERVICE_ORDER_ID,
            deletedAt: null,
          }),
        }),
      );
    });

    it('tenant isolation: não lista POs de outra empresa', async () => {
      prisma.purchaseOrder.findMany.mockResolvedValue([]);

      await service.findAll(OTHER_COMPANY_ID);

      expect(prisma.purchaseOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: OTHER_COMPANY_ID,
          }),
        }),
      );
    });
  });

  // ── findOne ──────────────────────────────────────────────

  describe('findOne', () => {
    it('retorna PO quando existe', async () => {
      prisma.purchaseOrder.findFirst.mockResolvedValue(mockPO());

      const result = await service.findOne(COMPANY_ID, PO_ID);

      expect(result.id).toBe(PO_ID);
      expect(result.items).toHaveLength(1);
    });

    it('lança NotFoundException quando não existe', async () => {
      prisma.purchaseOrder.findFirst.mockResolvedValue(null);

      await expect(service.findOne(COMPANY_ID, 'inexistente')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('tenant isolation: PO de outra empresa não é encontrado', async () => {
      prisma.purchaseOrder.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne(OTHER_COMPANY_ID, PO_ID),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.purchaseOrder.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: PO_ID,
            companyId: OTHER_COMPANY_ID,
            deletedAt: null,
          }),
        }),
      );
    });
  });

  // ── updateStatus ────────────────────────────────────────

  describe('updateStatus', () => {
    it('DRAFT → ORDERED: transição válida', async () => {
      prisma.purchaseOrder.findFirst.mockResolvedValue(
        mockPO({ status: 'DRAFT' }),
      );
      prisma.purchaseOrder.update.mockResolvedValue(
        mockPO({ status: 'ORDERED' }),
      );

      const result = await service.updateStatus(COMPANY_ID, PO_ID, 'ORDERED');

      expect(result.status).toBe('ORDERED');
      expect(prisma.purchaseOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'ORDERED' },
        }),
      );
    });

    it('ORDERED → RECEIVED: transição válida e cria movimentos de entrada', async () => {
      prisma.purchaseOrder.findFirst.mockResolvedValue(
        mockPO({ status: 'ORDERED' }),
      );
      prisma.purchaseOrder.update.mockResolvedValue(
        mockPO({ status: 'RECEIVED' }),
      );
      prisma.material.findFirst.mockResolvedValue({ id: MATERIAL_ID });
      inventory.createMovement.mockResolvedValue({ movement: {}, material: {} });

      const result = await service.updateStatus(COMPANY_ID, PO_ID, 'RECEIVED');

      expect(result.status).toBe('RECEIVED');
      expect(prisma.material.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: MATERIAL_ID,
            companyId: COMPANY_ID,
            deletedAt: null,
          }),
        }),
      );
      expect(inventory.createMovement).toHaveBeenCalledWith(
        COMPANY_ID,
        expect.objectContaining({
          materialId: MATERIAL_ID,
          type: 'ENTRADA',
          quantity: 10,
          unitCost: 100,
        }),
      );
    });

    it('ORDERED → CANCELLED: transição válida', async () => {
      prisma.purchaseOrder.findFirst.mockResolvedValue(
        mockPO({ status: 'ORDERED' }),
      );
      prisma.purchaseOrder.update.mockResolvedValue(
        mockPO({ status: 'CANCELLED' }),
      );

      const result = await service.updateStatus(COMPANY_ID, PO_ID, 'CANCELLED');

      expect(result.status).toBe('CANCELLED');
    });

    it('DRAFT → CANCELLED: transição válida', async () => {
      prisma.purchaseOrder.findFirst.mockResolvedValue(
        mockPO({ status: 'DRAFT' }),
      );
      prisma.purchaseOrder.update.mockResolvedValue(
        mockPO({ status: 'CANCELLED' }),
      );

      const result = await service.updateStatus(COMPANY_ID, PO_ID, 'CANCELLED');

      expect(result.status).toBe('CANCELLED');
    });

    it('DRAFT → RECEIVED: transição INVÁLIDA (deve passar por ORDERED)', async () => {
      prisma.purchaseOrder.findFirst.mockResolvedValue(
        mockPO({ status: 'DRAFT' }),
      );

      await expect(
        service.updateStatus(COMPANY_ID, PO_ID, 'RECEIVED'),
      ).rejects.toThrow(BadRequestException);
    });

    it('RECEIVED → ORDERED: transição INVÁLIDA (estado terminal)', async () => {
      prisma.purchaseOrder.findFirst.mockResolvedValue(
        mockPO({ status: 'RECEIVED' }),
      );

      await expect(
        service.updateStatus(COMPANY_ID, PO_ID, 'ORDERED'),
      ).rejects.toThrow(BadRequestException);
    });

    it('CANCELLED → ORDERED: transição INVÁLIDA (estado terminal)', async () => {
      prisma.purchaseOrder.findFirst.mockResolvedValue(
        mockPO({ status: 'CANCELLED' }),
      );

      await expect(
        service.updateStatus(COMPANY_ID, PO_ID, 'ORDERED'),
      ).rejects.toThrow(BadRequestException);
    });

    it('lança NotFoundException quando PO não existe', async () => {
      prisma.purchaseOrder.findFirst.mockResolvedValue(null);

      await expect(
        service.updateStatus(COMPANY_ID, 'inexistente', 'ORDERED'),
      ).rejects.toThrow(NotFoundException);
    });

    it('RECEIVED: não cria movimento quando catalogItemId não é Material', async () => {
      prisma.purchaseOrder.findFirst.mockResolvedValue(
        mockPO({
          status: 'ORDERED',
          items: [
            {
              id: 'item-1',
              purchaseOrderId: PO_ID,
              catalogItemId: 'prod-1', // um Product, não um Material
              description: 'Produto',
              quantity: 5,
              unitPrice: 50,
              total: 250,
              createdAt: new Date(),
            },
          ],
        }),
      );
      prisma.purchaseOrder.update.mockResolvedValue(
        mockPO({ status: 'RECEIVED' }),
      );
      prisma.material.findFirst.mockResolvedValue(null); // não é um Material

      await service.updateStatus(COMPANY_ID, PO_ID, 'RECEIVED');

      expect(inventory.createMovement).not.toHaveBeenCalled();
    });

    it('RECEIVED: pula items sem catalogItemId', async () => {
      prisma.purchaseOrder.findFirst.mockResolvedValue(
        mockPO({
          status: 'ORDERED',
          items: [
            {
              id: 'item-1',
              purchaseOrderId: PO_ID,
              catalogItemId: null,
              description: 'Serviço',
              quantity: 1,
              unitPrice: 500,
              total: 500,
              createdAt: new Date(),
            },
          ],
        }),
      );
      prisma.purchaseOrder.update.mockResolvedValue(
        mockPO({ status: 'RECEIVED' }),
      );

      await service.updateStatus(COMPANY_ID, PO_ID, 'RECEIVED');

      expect(prisma.material.findFirst).not.toHaveBeenCalled();
      expect(inventory.createMovement).not.toHaveBeenCalled();
    });
  });

  // ── remove ───────────────────────────────────────────────

  describe('remove', () => {
    it('soft delete: marca deletedAt', async () => {
      prisma.purchaseOrder.findFirst.mockResolvedValue(mockPO());
      prisma.purchaseOrder.update.mockResolvedValue({
        ...mockPO(),
        deletedAt: new Date(),
      });

      const result = await service.remove(COMPANY_ID, PO_ID);

      expect(prisma.purchaseOrder.update).toHaveBeenCalledWith({
        where: { id: PO_ID },
        data: { deletedAt: expect.any(Date) },
      });
      expect(result.deletedAt).toBeDefined();
    });

    it('lança NotFoundException quando PO não existe', async () => {
      prisma.purchaseOrder.findFirst.mockResolvedValue(null);

      await expect(
        service.remove(COMPANY_ID, 'inexistente'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── tenant isolation ────────────────────────────────────

  describe('tenant isolation', () => {
    it('create não cria PO para supplier de outra empresa', async () => {
      mockSupplierNotFound();

      await expect(
        service.create(OTHER_COMPANY_ID, {
          supplierId: SUPPLIER_ID,
          items: [{ description: 'x', quantity: 1, unitPrice: 10 }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('findAll não retorna POs de outra empresa', async () => {
      prisma.purchaseOrder.findMany.mockResolvedValue([]);

      const result = await service.findAll(OTHER_COMPANY_ID);

      expect(prisma.purchaseOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: OTHER_COMPANY_ID,
          }),
        }),
      );
      expect(result).toHaveLength(0);
    });
  });
});
