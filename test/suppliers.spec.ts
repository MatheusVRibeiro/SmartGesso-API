import { NotFoundException } from '@nestjs/common';
import { SuppliersService } from '../src/modules/suppliers/suppliers.service';

/**
 * Testes unitários do SuppliersService — ETAPA 10.
 *
 * PrismaService é mockado — nenhum banco é acessado.
 *
 * Cobre: CRUD, tenant isolation e busca por texto.
 */
describe('SuppliersService', () => {
  let service: SuppliersService;
  let prisma: any;

  const COMPANY_ID = 'company-1';
  const OTHER_COMPANY_ID = 'company-2';
  const SUPPLIER_ID = 'sup-1';

  beforeEach(() => {
    prisma = {
      supplier: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };
    service = new SuppliersService(prisma);
  });

  // ── Helpers ──────────────────────────────────────────────

  function mockSupplier(overrides: Record<string, any> = {}) {
    return {
      id: SUPPLIER_ID,
      companyId: COMPANY_ID,
      name: 'Fornecedor Teste',
      cnpjCpf: '12345678000195',
      phone: '11999999999',
      email: 'fornecedor@teste.com',
      address: 'Rua Teste, 123',
      notes: 'Observações',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      ...overrides,
    };
  }

  // ── create ───────────────────────────────────────────────

  describe('create', () => {
    it('cria fornecedor scoped pela empresa do contexto', async () => {
      prisma.supplier.create.mockResolvedValue(mockSupplier());

      const result = await service.create(COMPANY_ID, {
        name: 'Fornecedor Teste',
        cnpjCpf: '12345678000195',
        phone: '11999999999',
        email: 'fornecedor@teste.com',
        address: 'Rua Teste, 123',
        notes: 'Observações',
      });

      expect(prisma.supplier.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: COMPANY_ID,
            name: 'Fornecedor Teste',
            cnpjCpf: '12345678000195',
            email: 'fornecedor@teste.com',
          }),
        }),
      );
      expect(result.name).toBe('Fornecedor Teste');
    });

    it('não inclui companyId do body — sempre usa o do contexto', async () => {
      prisma.supplier.create.mockResolvedValue(mockSupplier());

      await service.create(COMPANY_ID, { name: 'Fornecedor X' });

      const call = prisma.supplier.create.mock.calls[0][0];
      expect(call.data.companyId).toBe(COMPANY_ID);
    });
  });

  // ── findAll ──────────────────────────────────────────────

  describe('findAll', () => {
    it('lista fornecedores não-deletados da empresa', async () => {
      const suppliers = [
        mockSupplier(),
        mockSupplier({ id: 'sup-2', name: 'Outro Fornecedor' }),
      ];
      prisma.supplier.findMany.mockResolvedValue(suppliers);

      const result = await service.findAll(COMPANY_ID);

      expect(prisma.supplier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: COMPANY_ID,
            deletedAt: null,
          }),
          orderBy: { name: 'asc' },
        }),
      );
      expect(result).toHaveLength(2);
    });

    it('filtra por search (name, cnpjCpf, email)', async () => {
      prisma.supplier.findMany.mockResolvedValue([]);

      await service.findAll(COMPANY_ID, 'teste');

      expect(prisma.supplier.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ name: { contains: 'teste' } }),
              expect.objectContaining({ cnpjCpf: { contains: 'teste' } }),
              expect.objectContaining({ email: { contains: 'teste' } }),
            ]),
          }),
        }),
      );
    });

    it('tenant isolation: não lista fornecedores de outra empresa', async () => {
      prisma.supplier.findMany.mockResolvedValue([]);

      await service.findAll(OTHER_COMPANY_ID);

      expect(prisma.supplier.findMany).toHaveBeenCalledWith(
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
    it('retorna fornecedor quando existe', async () => {
      prisma.supplier.findFirst.mockResolvedValue(mockSupplier());

      const result = await service.findOne(COMPANY_ID, SUPPLIER_ID);

      expect(result.name).toBe('Fornecedor Teste');
    });

    it('lança NotFoundException quando não existe', async () => {
      prisma.supplier.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne(COMPANY_ID, 'inexistente'),
      ).rejects.toThrow(NotFoundException);
    });

    it('tenant isolation: fornecedor de outra empresa não é encontrado', async () => {
      prisma.supplier.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne(OTHER_COMPANY_ID, SUPPLIER_ID),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.supplier.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: SUPPLIER_ID,
            companyId: OTHER_COMPANY_ID,
            deletedAt: null,
          }),
        }),
      );
    });
  });

  // ── update ───────────────────────────────────────────────

  describe('update', () => {
    it('atualiza fornecedor existente', async () => {
      prisma.supplier.findFirst.mockResolvedValue(mockSupplier());
      prisma.supplier.update.mockResolvedValue(
        mockSupplier({ name: 'Fornecedor Atualizado' }),
      );

      const result = await service.update(COMPANY_ID, SUPPLIER_ID, {
        name: 'Fornecedor Atualizado',
      });

      expect(prisma.supplier.update).toHaveBeenCalledWith({
        where: { id: SUPPLIER_ID },
        data: expect.objectContaining({
          name: 'Fornecedor Atualizado',
        }),
      });
      expect(result.name).toBe('Fornecedor Atualizado');
    });

    it('lança NotFoundException quando fornecedor não existe', async () => {
      prisma.supplier.findFirst.mockResolvedValue(null);

      await expect(
        service.update(COMPANY_ID, 'inexistente', { name: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('tenant isolation: não atualiza fornecedor de outra empresa', async () => {
      prisma.supplier.findFirst.mockResolvedValue(null);

      await expect(
        service.update(OTHER_COMPANY_ID, SUPPLIER_ID, { name: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── remove ───────────────────────────────────────────────

  describe('remove', () => {
    it('soft delete: marca deletedAt', async () => {
      prisma.supplier.findFirst.mockResolvedValue(mockSupplier());
      prisma.supplier.update.mockResolvedValue({
        ...mockSupplier(),
        deletedAt: new Date(),
      });

      const result = await service.remove(COMPANY_ID, SUPPLIER_ID);

      expect(prisma.supplier.update).toHaveBeenCalledWith({
        where: { id: SUPPLIER_ID },
        data: { deletedAt: expect.any(Date) },
      });
      expect(result.deletedAt).toBeDefined();
    });

    it('lança NotFoundException quando fornecedor não existe', async () => {
      prisma.supplier.findFirst.mockResolvedValue(null);

      await expect(
        service.remove(COMPANY_ID, 'inexistente'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
